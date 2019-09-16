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
const initConfig = require('./utils/init-config')
const { startAria2, stopAria2 } = require('./utils/aria2')
const filenamify = require('./utils/filenamify')
const isValidUrl = require('./utils/is-valid-url')
const { getGlobalState, setGlobalState } = require('./utils/global-state')

const startTime = Date.now()
let progressIntervalId
const bar = new ProgressBarFormatter({
  complete: '=',
  incomplete: ' ',
  length: 18,
})

function update(lines) {
  logUpdate(Array.isArray(lines) ? lines.join('\n') : lines)
}

function readGalleryUrlFromCLI() {
  const inputGalleryUrl = process.argv[2]

  if (!inputGalleryUrl) {
    throw new Error('Please specify the sample gallery url.')
  }

  if (!isValidUrl(inputGalleryUrl)) {
    throw new Error(`Unrecognizable input: ${inputGalleryUrl}`)
  }

  setGlobalState('inputGalleryUrl', inputGalleryUrl)
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
  const config = getGlobalState('config')
  const galleryData = getGlobalState('galleryData')

  setGlobalState('displayTitle', chalk.bold('Gallery: ' + galleryData.title))
  setGlobalState('outputDir', path.join(config.outputDir, filenamify(galleryData.title)))
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
  const config = getGlobalState('config')
  const aria2client = getGlobalState('aria2.instance')
  const tasks = setGlobalState('tasks.data', Object.create(null))
  const items = getGlobalState('galleryData.items')

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const filename = filenamify(item.name)
    const isProxyEnabled = config.enableProxy(item.url)
    const gid = await aria2client.call('addUri', [ item.url ], {
      'dir': getGlobalState('outputDir'),
      'out': filename,
      'referer': getGlobalState('aria2.referer'),
      'all-proxy': isProxyEnabled
        ? config.proxy
        : null,
    })

    tasks[gid] = {
      index: i + 1,
      filename,
      isProxyEnabled,
    }
  }

  fs.writeFileSync(
    getGlobalState('tasks.jsonFilePath'),
    JSON.stringify(tasks, null, 2),
  )
}

function readTasks() {
  const tasks = setGlobalState('tasks.data', Object.create(null))

  Object.assign(tasks, require(getGlobalState('tasks.jsonFilePath')))
}

async function checkProgress() {
  const galleryData = getGlobalState('galleryData')
  const aria2client = getGlobalState('aria2.instance')
  const port = getGlobalState('aria2.port')
  const tasks = getGlobalState('tasks.data')
  const activeDownloads = await aria2client.call('tellActive')
  const globalStat = await aria2client.call('getGlobalStat')

  if (!Number(globalStat.numActive) && !Number(globalStat.numWaiting)) {
    return done()
  }

  const taskStatusLines = activeDownloads.map(download => {
    const task = tasks[download.gid]
    const total = galleryData.items.length
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

    return [
      chalk.gray('Downloading:'),
      chalk.green(`[${leftPad(task.index, total.toString().length)}/${total}]`),
      '[' + chalk.gray(bar.format(percent)) + ']',
      leftPad(totalLength ? prettyBytes(totalLength) : '', 12),
      leftPad(downloadSpeed ? `${prettyBytes(downloadSpeed)}/s` : '', 12),
      leftPad(remaining ? prettyMs(remaining) : '', 12),
      chalk.cyan(task.filename) + proxyIndicator,
    ].join(' ')
  })

  update([
    getGlobalState('displayTitle'),
    '',
    ...taskStatusLines,
    '',
    `Overall speed: ${prettyBytes(Number(globalStat.downloadSpeed))}/s`,
    `aria2 RPC interface is listening at http://localhost:${port}/jsonrpc (no secret token)`,
  ])
}

function setupRunner() {
  checkProgress()

  progressIntervalId = setInterval(checkProgress, 1000)
}

async function done() {
  clearInterval(progressIntervalId)
  await stopAria2()

  fs.unlinkSync(getGlobalState('aria2.session.filePath'))
  fs.unlinkSync(getGlobalState('tasks.jsonFilePath'))

  const diff = prettyMs(Date.now() - startTime)
  update([
    getGlobalState('displayTitle'),
    '',
    `All tasks done in ${diff}.`,
  ])

  process.exit(0)
}

async function main() {
  try {
    initConfig()
    readGalleryUrlFromCLI()
    await getGalleryData()
    await prepare()
    await initTasks()
    setupRunner()
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

main()
