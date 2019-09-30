'use strict'

const fs = require('fs')
const path = require('path')
const assert = require('assert')
const chalk = require('chalk')
const ProgressBarFormatter = require('progress-bar-formatter')
const logUpdate = require('log-update')
const makeDir = require('make-dir')
const prettyBytes = require('pretty-bytes')
const prettyMs = require('pretty-ms')
const leftPad = require('left-pad')
const { readConfig } = require('./utils/config')
const { isMutexLocked, lockMutex } = require('./utils/mutex')
const { initWaitingList, getWaitingList, isWaitingListEmpty, isInWaitingList, addToWaitingList, removeFromWaitingList, moveToTopOfList } = require('./utils/waiting-list')
const { startAria2, stopAria2 } = require('./utils/aria2')
const filenamify = require('./utils/filenamify')
const isValidUrl = require('./utils/is-valid-url')
const SpeedAnalyzer = require('./utils/speed-analyzer')
const writeJson = require('./utils/write-json')
const { getGlobalState, setGlobalState, resetGlobalState } = require('./utils/global-state')

const startTime = Date.now()
let progressIntervalId
let speedIntervalId
const bar = new ProgressBarFormatter({
  complete: '=',
  incomplete: ' ',
  length: 18,
})

function update(lines) {
  const message = Array.isArray(lines) ? lines.join('\n') : lines

  logUpdate(message.trim())
}

function getGalleryLoader() {
  const inputGalleryUrl = getGlobalState('inputGalleryUrl')

  if (inputGalleryUrl.includes('dpreview.com')) return require('./gallery-loaders/dpreview')
  if (inputGalleryUrl.includes('imaging-resource.com')) return require('./gallery-loaders/imaging-resource')
  if (inputGalleryUrl.includes('photographyblog.com')) return require('./gallery-loaders/photography-blog')
  if (inputGalleryUrl.includes('dcfever.com')) return require('./gallery-loaders/dcfever')

  throw new Error('Unknown website')
}

async function getGalleryData() {
  update('Fetching gallery data...')

  const galleryLoader = getGalleryLoader()

  await galleryLoader()

  const { title, items } = getGlobalState('galleryData')

  assert(typeof title === 'string' && title.length)
  assert(Array.isArray(items) && items.length)
}

async function prepare() {
  const galleryData = getGlobalState('galleryData')

  setGlobalState('outputDir', path.join(readConfig('outputDir'), filenamify(galleryData.title)))
  setGlobalState('aria2.session.filePath', path.join(getGlobalState('outputDir'), 'aria2.session'))
  setGlobalState('aria2.session.isExists', fs.existsSync(getGlobalState('aria2.session.filePath')))
  setGlobalState('tasks.jsonFilePath', path.join(getGlobalState('outputDir'), 'tasks.json'))

  if (!setGlobalState('aria2.referer')) {
    setGlobalState('aria2.referer', getGlobalState('inputGalleryUrl'))
  }

  await startAria2()
  await makeDir(getGlobalState('outputDir'))
}

function initTasks() {
  return getGlobalState('aria2.session.isExists')
    ? readTasks()
    : createTasks()
}

async function createTasks() {
  const aria2client = getGlobalState('aria2.instance')
  const tasks = setGlobalState('tasks.data', Object.create(null))
  const items = getGlobalState('galleryData.items')

  for (const [ i, item ] of items.entries()) {
    const filename = filenamify(item.name)
    const isProxyEnabled = readConfig('enableProxy')(item.url)
    const gid = await aria2client.call('addUri', [ item.url ], {
      'dir': getGlobalState('outputDir'),
      'out': filename,
      'referer': getGlobalState('aria2.referer'),
      'all-proxy': isProxyEnabled
        ? readConfig('proxy')
        : null,
    })

    tasks[gid] = {
      index: i + 1,
      gid,
      filename,
      isProxyEnabled,
      speedAnalyzer: null,
    }
  }

  writeJson(getGlobalState('tasks.jsonFilePath'), tasks)
}

function readTasks() {
  const tasks = setGlobalState('tasks.data', Object.create(null))

  Object.assign(tasks, require(getGlobalState('tasks.jsonFilePath')))
}

function initSpeedAnalyzer() {
  const tasks = getGlobalState('tasks.data')

  for (const task of Object.values(tasks)) {
    task.speedAnalyzer = new SpeedAnalyzer()
  }
}

async function retryTask(task) {
  const aria2client = getGlobalState('aria2.instance')

  task.speedAnalyzer.clear()
  await aria2client.call('pause', task.gid)
  await aria2client.call('unpause', task.gid)
}

async function checkProgress() {
  const galleryData = getGlobalState('galleryData')
  const aria2client = getGlobalState('aria2.instance')
  const tasks = getGlobalState('tasks.data')
  const activeDownloads = await aria2client.call('tellActive')
  const globalStat = await aria2client.call('getGlobalStat')
  const numberTotal = galleryData.items.length
  const numberCompleted = numberTotal - globalStat.numActive - globalStat.numWaiting

  if (!Number(globalStat.numActive) && !Number(globalStat.numWaiting)) {
    return done()
  }

  const taskStatusLines = activeDownloads.map(download => {
    const task = tasks[download.gid]
    const totalLength = Number(download.totalLength)
    const completedLength = Number(download.completedLength)
    const downloadSpeed = Number(download.downloadSpeed)
    const percent = completedLength / totalLength || 0
    const remaining = downloadSpeed
      ? (1 - percent) * completedLength / downloadSpeed * 1000
      : NaN
    const proxyIndicator = task.isProxyEnabled
      ? chalk.red('*')
      : ' '

    if (task.speedAnalyzer.hasEnoughSamples()) {
      if (task.speedAnalyzer.getAverageDownloadSpeed() < 256 * 1024) {
        retryTask(task)
      }
    }

    return [
      chalk.gray('Downloading:'),
      chalk.green(`[${leftPad(task.index, numberTotal.toString().length)}/${numberTotal}]`),
      '[' + chalk.gray(bar.format(percent)) + ']',
      leftPad(totalLength ? prettyBytes(totalLength) : '', 12),
      leftPad(downloadSpeed ? `${prettyBytes(downloadSpeed)}/s` : '', 12),
      leftPad(remaining ? prettyMs(remaining) : '', 12),
      chalk.cyan(task.filename) + proxyIndicator,
    ].join(' ')
  })

  const waitingListStatusLines = getWaitingList()
    .filter(item => item !== getGlobalState('inputGalleryUrl'))
    .map(item => `- ${item}`)

  if (waitingListStatusLines.length) {
    waitingListStatusLines.unshift('Waiting:')
  }

  update([
    `Gallery: ${chalk.bold(galleryData.title)}`,
    '',
    ...taskStatusLines,
    '',
    `Overall speed: ${chalk.bold(prettyBytes(Number(globalStat.downloadSpeed)) + '/s')}`,
    `Overall progress: [${chalk.bold(bar.format(numberCompleted / numberTotal))}] ${numberCompleted} completed, ${numberTotal - numberCompleted} remaining`,
    `aria2 RPC interface is listening at ${chalk.bold(aria2client.url('http'))} (no secret token)`,
    '',
    ...waitingListStatusLines,
  ])
}

async function trackDownloadSpeed() {
  const aria2client = getGlobalState('aria2.instance')
  const tasks = getGlobalState('tasks.data')
  const activeDownloads = await aria2client.call('tellActive')

  for (const download of activeDownloads) {
    const task = tasks[download.gid]

    task.speedAnalyzer.add({
      downloadSpeed: Number(download.downloadSpeed),
      completedLength: Number(download.completedLength),
    })
  }
}

function setupRunner() {
  checkProgress()
  trackDownloadSpeed()

  progressIntervalId = setInterval(checkProgress, 1000)
  speedIntervalId = setInterval(trackDownloadSpeed, 250)
}

async function done() {
  clearInterval(progressIntervalId)
  clearInterval(speedIntervalId)
  await stopAria2()

  fs.unlinkSync(getGlobalState('aria2.session.filePath'))
  fs.unlinkSync(getGlobalState('tasks.jsonFilePath'))

  const inputGalleryUrl = getGlobalState('inputGalleryUrl')

  removeFromWaitingList(inputGalleryUrl)

  if (!isWaitingListEmpty()) {
    processGallery()
  } else {
    const diff = prettyMs(Date.now() - startTime)

    update(`All tasks done in ${diff}.`)
    process.exit(0)
  }
}

async function processGallery() {
  const waitingList = getWaitingList()
  const inputGalleryUrl = waitingList[0]

  resetGlobalState()
  setGlobalState('inputGalleryUrl', inputGalleryUrl)

  await getGalleryData()
  await prepare()
  await initTasks()
  initSpeedAnalyzer()
  setupRunner()
}

async function main() {
  await initWaitingList()

  const hasInput = process.argv.length >= 3
  const inputGalleryUrl = process.argv[2]
  const isAlreadyInWaitingList = hasInput && isInWaitingList(inputGalleryUrl)
  const isLocked = isMutexLocked()

  if (hasInput && !isValidUrl(inputGalleryUrl)) {
    throw new Error(`Unrecognizable input: ${inputGalleryUrl}`)
  }

  if (hasInput && !isAlreadyInWaitingList) {
    addToWaitingList(inputGalleryUrl)
  }

  if (hasInput && !isLocked) {
    moveToTopOfList(inputGalleryUrl)
  }

  if (hasInput && isLocked) {
    if (isAlreadyInWaitingList) {
      logUpdate('The gallery is already in the waiting list.')
    } else {
      logUpdate('Another instance is running. Added the gallery to the waiting list.')
    }
  }

  if (!hasInput && isLocked) {
    logUpdate('Another instance is running.')
  }

  if (!hasInput && !isLocked && isWaitingListEmpty()) {
    throw new Error('Please specify the sample gallery url.')
  }

  if (!isLocked && !isWaitingListEmpty()) {
    lockMutex()
    processGallery()
  } else {
    process.exit(0)
  }
}
main()

process.on('unhandledRejection', error => {
  console.error(error)
  process.exit(1)
})
