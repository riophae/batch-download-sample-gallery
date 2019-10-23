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
const Mutex = require('./utils/mutex')
const WaitingList = require('./utils/waiting-list')
const GlobalState = require('./utils/global-state')
const { startAria2, stopAria2 } = require('./utils/aria2')
const filenamify = require('./utils/filenamify')
const isValidUrl = require('./utils/is-valid-url')
const SpeedAnalyzer = require('./utils/speed-analyzer')
const writeJson = require('./utils/write-json')

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
  const inputGalleryUrl = GlobalState.get('inputGalleryUrl')

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

  const { title, items } = GlobalState.get('galleryData')

  assert(typeof title === 'string' && title.length)
  assert(Array.isArray(items) && items.length)
}

async function prepare() {
  const galleryData = GlobalState.get('galleryData')

  GlobalState.set('outputDir', path.join(readConfig('outputDir'), filenamify(galleryData.title)))
  GlobalState.set('aria2.session.filePath', path.join(GlobalState.get('outputDir'), 'aria2.session'))
  GlobalState.set('aria2.session.isExists', fs.existsSync(GlobalState.get('aria2.session.filePath')))
  GlobalState.set('tasks.jsonFilePath', path.join(GlobalState.get('outputDir'), 'tasks.json'))

  if (!GlobalState.get('aria2.referer')) {
    GlobalState.set('aria2.referer', GlobalState.get('inputGalleryUrl'))
  }

  await startAria2()
  await makeDir(GlobalState.get('outputDir'))
}

function initTasks() {
  return GlobalState.get('aria2.session.isExists')
    ? readTasks()
    : createTasks()
}

async function createTasks() {
  const aria2client = GlobalState.get('aria2.instance')
  const tasks = GlobalState.set('tasks.data', Object.create(null))
  const items = GlobalState.get('galleryData.items')

  for (const [ i, item ] of items.entries()) {
    const filename = filenamify(item.name)
    const isProxyEnabled = readConfig('enableProxy')(item.url)
    const gid = await aria2client.call('addUri', [ item.url ], {
      'dir': GlobalState.get('outputDir'),
      'out': filename,
      'referer': GlobalState.get('aria2.referer'),
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

  writeJson(GlobalState.get('tasks.jsonFilePath'), tasks)
}

function readTasks() {
  const tasks = GlobalState.set('tasks.data', Object.create(null))

  Object.assign(tasks, require(GlobalState.get('tasks.jsonFilePath')))
}

function initSpeedAnalyzer() {
  const tasks = GlobalState.get('tasks.data')

  for (const task of Object.values(tasks)) {
    task.speedAnalyzer = new SpeedAnalyzer()
  }
}

function sortDownloads(activeDownloads) {
  const tasks = GlobalState.get('tasks.data')

  return activeDownloads.sort((a, b) => {
    const indexA = tasks[a.gid].index
    const indexB = tasks[b.gid].index

    return indexA - indexB
  })
}

async function retryTask(task) {
  const aria2client = GlobalState.get('aria2.instance')

  task.speedAnalyzer.clear()
  await aria2client.call('pause', task.gid)
  await aria2client.call('unpause', task.gid)
}

async function checkProgress() {
  const galleryData = GlobalState.get('galleryData')
  const aria2client = GlobalState.get('aria2.instance')
  const tasks = GlobalState.get('tasks.data')
  const activeDownloads = await aria2client.call('tellActive')
  const globalStat = await aria2client.call('getGlobalStat')
  const numberTotal = galleryData.items.length
  const numberCompleted = numberTotal - globalStat.numActive - globalStat.numWaiting

  if (!Number(globalStat.numActive) && !Number(globalStat.numWaiting)) {
    return done()
  }

  const taskStatusLines = sortDownloads(activeDownloads).map(download => {
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

  const waitingListStatusLines = WaitingList.get()
    .filter(item => item !== GlobalState.get('inputGalleryUrl'))
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
  const aria2client = GlobalState.get('aria2.instance')
  const tasks = GlobalState.get('tasks.data')
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

  fs.unlinkSync(GlobalState.get('aria2.session.filePath'))
  fs.unlinkSync(GlobalState.get('tasks.jsonFilePath'))

  const inputGalleryUrl = GlobalState.get('inputGalleryUrl')

  WaitingList.remove(inputGalleryUrl)

  if (!WaitingList.isEmpty()) {
    processGallery()
  } else {
    const diff = prettyMs(Date.now() - startTime)

    update(`All tasks done in ${diff}.`)
    process.exit(0)
  }
}

async function processGallery() {
  const inputGalleryUrl = WaitingList.get()[0]

  GlobalState.reset()
  GlobalState.set('inputGalleryUrl', inputGalleryUrl)

  await getGalleryData()
  await prepare()
  await initTasks()
  initSpeedAnalyzer()
  setupRunner()
}

async function main() {
  await WaitingList.init()

  const hasInput = process.argv.length >= 3
  const inputGalleryUrl = process.argv[2]
  const isAlreadyInWaitingList = hasInput && WaitingList.isInList(inputGalleryUrl)
  const isLocked = Mutex.isLocked()

  if (hasInput && !isValidUrl(inputGalleryUrl)) {
    throw new Error(`Unrecognizable input: ${inputGalleryUrl}`)
  }

  if (hasInput && !isAlreadyInWaitingList) {
    WaitingList.add(inputGalleryUrl)
  }

  if (hasInput && !isLocked) {
    WaitingList.moveToTop(inputGalleryUrl)
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

  if (!hasInput && !isLocked && WaitingList.isEmpty()) {
    throw new Error('Please specify the sample gallery url.')
  }

  if (!isLocked && !WaitingList.isEmpty()) {
    Mutex.lock()
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
