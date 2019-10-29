'use strict'

const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const makeDir = require('make-dir')
const prettyMs = require('pretty-ms')
const leftPad = require('left-pad')

const { isWebsiteSupported, isGalleryUrlValid } = require('./adapters')

const Mutex = require('./libs/mutex')
const WaitingList = require('./libs/waiting-list')
const Config = require('./libs/config')
const GlobalState = require('./libs/global-state')
const Aria2 = require('./libs/aria2')
const SpeedAnalyzer = require('./libs/speed-analyzer')

const GlobalStopwatch = require('./utils/global-stopwatch')
const isValidUrl = require('./utils/is-valid-url')
const updateStdout = require('./utils/update-stdout')
const filenamify = require('./utils/filenamify')
const xbytes = require('./utils/xbytes')
const writeJsonFile = require('./utils/write-json-file')
const progressBar = require('./utils/progress-bar')

let progressIntervalId
let speedIntervalId

async function prepare() {
  const galleryData = GlobalState.get('galleryData')

  GlobalState.set('outputDir', path.join(Config.read('outputDir'), filenamify(galleryData.title)))
  GlobalState.set('aria2.sessionFile.path', path.join(GlobalState.get('outputDir'), 'aria2.session'))
  GlobalState.set('aria2.sessionFile.isExisting', fs.existsSync(GlobalState.get('aria2.sessionFile.path')))
  GlobalState.set('tasks.jsonFilePath', path.join(GlobalState.get('outputDir'), 'tasks.json'))
  GlobalState.set('tasks.data', Object.create(null))

  await Aria2.start()
  await makeDir(GlobalState.get('outputDir'))

  const aria2client = Aria2.getClient()

  aria2client.on('onDownloadPause', downloads => {
    clearSpeedAnalyzerForDownloads(downloads)
  })
  aria2client.on('onDownloadComplete', downloads => {
    clearSpeedAnalyzerForDownloads(downloads)
  })
}

function initTasks() {
  return GlobalState.get('aria2.sessionFile.isExisting')
    ? readTasks()
    : createTasks()
}

async function createTasks() {
  const aria2client = Aria2.getClient()
  const tasks = GlobalState.get('tasks.data')
  const items = GlobalState.get('galleryData.items')

  for (const [ i, item ] of items.entries()) {
    const filename = filenamify(item.name)
    const isProxyEnabled = Config.read('enableProxy')(item.url)
    const gid = await aria2client.call('addUri', [ item.url ], {
      'dir': GlobalState.get('outputDir'),
      'out': filename,
      'referer': GlobalState.get('galleryData.actualGalleryUrl'),
      'all-proxy': isProxyEnabled
        ? Config.read('proxy')
        : null,
    })

    tasks[gid] = {
      index: i + 1,
      gid,
      filename,
      url: item.url,
      isProxyEnabled,
      speedAnalyzer: null,
    }
  }

  writeJsonFile(GlobalState.get('tasks.jsonFilePath'), tasks)
}

async function readTasks() {
  const aria2client = Aria2.getClient()
  const tasks = GlobalState.get('tasks.data')

  Object.assign(tasks, require(GlobalState.get('tasks.jsonFilePath')))

  for (const [ gid, task ] of Object.entries(tasks)) {
    const oldProxySetting = task.isProxyEnabled
    const newProxySetting = Config.read('enableProxy')(task.url)

    if (oldProxySetting !== newProxySetting) {
      task.isProxyEnabled = newProxySetting

      await aria2client.call('changeOption', gid, {
        'all-proxy': newProxySetting
          ? Config.read('proxy')
          : null,
      })
    }
  }

  writeJsonFile(GlobalState.get('tasks.jsonFilePath'), tasks)
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

function clearSpeedAnalyzerForDownloads(downloads) {
  const tasks = GlobalState.get('tasks.data')

  for (const download of downloads) {
    const { gid } = download
    const task = tasks[gid]

    if (task) task.speedAnalyzer.clear()
  }
}

async function retryTask(task) {
  const aria2client = Aria2.getClient()

  await aria2client.call('pause', task.gid)
  await aria2client.call('unpause', task.gid)
}

async function checkProgress() {
  const galleryData = GlobalState.get('galleryData')
  const aria2client = Aria2.getClient()
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
      '[' + chalk.gray(progressBar.format(percent)) + ']',
      leftPad(totalLength ? xbytes(totalLength) : '', 12),
      leftPad(downloadSpeed ? `${xbytes(downloadSpeed)}/s` : '', 12),
      leftPad(remaining ? prettyMs(remaining) : '', 12),
      chalk.cyan(task.filename) + proxyIndicator,
    ].join(' ')
  })

  const waitingListStatusLines = WaitingList.getRest()
    .map(entry => `  - ${entry.galleryData.title}`)
  if (waitingListStatusLines.length) {
    waitingListStatusLines.unshift('Waiting:')
  }

  updateStdout([
    `Gallery: ${chalk.bold(galleryData.title)}`,
    '',
    ...taskStatusLines,
    '',
    `Overall speed: ${chalk.bold(xbytes(Number(globalStat.downloadSpeed)) + '/s')}`,
    `Overall progress: [${chalk.bold(progressBar.format(numberCompleted / numberTotal))}] ${numberCompleted} completed, ${numberTotal - numberCompleted} remaining`,
    `aria2 RPC interface is listening at ${chalk.bold(aria2client.url('http'))} (no secret token)`,
    '',
    ...waitingListStatusLines,
  ])
}

async function trackDownloadSpeed() {
  const aria2client = Aria2.getClient()
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

  await Aria2.stop()

  fs.unlinkSync(GlobalState.get('aria2.sessionFile.path'))
  fs.unlinkSync(GlobalState.get('tasks.jsonFilePath'))

  const galleryUrl = GlobalState.get('galleryUrl')

  WaitingList.remove(galleryUrl)

  if (!WaitingList.isEmpty()) {
    processWaitingList()
  } else {
    const timeLapsed = prettyMs(GlobalStopwatch.tell())

    updateStdout(`All tasks done in ${timeLapsed}.`)
    process.exit(0)
  }
}

async function processWaitingList() {
  const entry = WaitingList.getCurrent()

  GlobalState.reset()
  GlobalState.set('galleryUrl', entry.galleryUrl)
  GlobalState.set('galleryData', entry.galleryData)

  await prepare()
  await initTasks()
  initSpeedAnalyzer()
  setupRunner()
}

async function main() {
  await WaitingList.init()

  const hasInput = process.argv.length >= 3
  const galleryUrl = process.argv[2]

  if (hasInput && !isValidUrl(galleryUrl)) {
    throw new Error(`Unrecognizable input: ${galleryUrl}`)
  }

  if (hasInput && !isWebsiteSupported(galleryUrl)) {
    throw new Error(`Website not supported: ${galleryUrl}`)
  }

  if (hasInput && !isGalleryUrlValid(galleryUrl)) {
    throw new Error(`The website is supported, but the url is not: ${galleryUrl}`)
  }

  const isAlreadyInWaitingList = hasInput && WaitingList.isInList(galleryUrl)
  const isLocked = Mutex.isLocked()

  if (hasInput && !isAlreadyInWaitingList) {
    await WaitingList.add(galleryUrl)
  }

  if (hasInput && !isLocked) {
    WaitingList.moveToTop(galleryUrl)
  }

  if (hasInput && isLocked) {
    if (isAlreadyInWaitingList) {
      updateStdout('The gallery is already in the waiting list.')
    } else {
      updateStdout('Another instance is running. Added the gallery to the waiting list.')
    }
  }

  if (!hasInput && isLocked) {
    updateStdout('Another instance is running.')
  }

  if (!hasInput && !isLocked && WaitingList.isEmpty()) {
    throw new Error('Please specify the sample gallery url.')
  }

  if (!isLocked && !WaitingList.isEmpty()) {
    Mutex.lock()
    processWaitingList()
  } else {
    process.exit(0)
  }
}
main()

process.on('unhandledRejection', error => {
  console.error(error)
  process.exit(1)
})
