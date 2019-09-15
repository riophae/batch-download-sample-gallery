'use strict'

const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const ProgressBarFormatter = require('progress-bar-formatter')
const logUpdate = require('log-update')
const makeDir = require('make-dir')
const prettyBytes = require('pretty-bytes')
const prettyMs = require('pretty-ms')
const leftPad = require('left-pad')
const startAria2 = require('./utils/start-aria2')
const filenamify = require('./utils/filenamify')
const { getGlobalState, setGlobalState } = require('./utils/global-state')

const config = getGlobalState('config')
const tasks = Object.create(null)
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

function getGalleryUrlFromCLI() {
  const galleryUrl = process.argv[2]

  if (!galleryUrl) {
    throw new Error('Please specify the sample gallery url.')
  }

  setGlobalState('galleryUrl', galleryUrl)
}

function getGalleryLoader() {
  const galleryUrl = getGlobalState('galleryUrl')

  if (galleryUrl.includes('dpreview.com')) return require('./gallery-loaders/dpreview')
  if (galleryUrl.includes('imaging-resource.com')) return require('./gallery-loaders/imaging-resource')
  if (galleryUrl.includes('photographyblog.com')) return require('./gallery-loaders/photography-blog')
  if (galleryUrl.includes('dcfever.com')) return require('./gallery-loaders/dcfever')

  throw new Error('Unknown website')
}

async function getGalleryData() {
  update('Fetching gallery data...')

  const galleryUrl = getGlobalState('galleryUrl')
  const galleryLoader = getGalleryLoader()
  const galleryData = await galleryLoader(galleryUrl)

  setGlobalState('galleryData', galleryData)
}

async function prepare() {
  const galleryData = getGlobalState('galleryData')

  setGlobalState('displayTitle', chalk.bold('Gallery: ' + galleryData.title))
  setGlobalState('outputDir', path.join(config.outputDir, filenamify(galleryData.title)))
  setGlobalState('aria2.session.path', path.join(getGlobalState('outputDir'), 'aria2.session'))
  setGlobalState('aria2.session.isExists', fs.existsSync(getGlobalState('aria2.session.path')))

  await startAria2()
  await makeDir(getGlobalState('outputDir'))
}

async function createTasks() {
  const galleryData = getGlobalState('galleryData')
  const aria2 = getGlobalState('aria2.instance')
  const { items, galleryUrl } = galleryData

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const filename = filenamify(item.name)
    const isProxyEnabled = config.enableProxy(item.url)
    const gid = await aria2.call('addUri', [ item.url ], {
      'dir': getGlobalState('outputDir'),
      'out': filename,
      'referer': galleryUrl,
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
}

async function checkProgress() {
  const galleryData = getGlobalState('galleryData')
  const aria2 = getGlobalState('aria2.instance')
  const port = getGlobalState('aria2.port')
  const activeDownloads = await aria2.call('tellActive')
  const globalStat = await aria2.call('getGlobalStat')

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
  const aria2 = getGlobalState('aria2.instance')

  clearInterval(progressIntervalId)
  await aria2.close()

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
    getGalleryUrlFromCLI()
    await getGalleryData()
    await prepare()
    await createTasks()
    setupRunner()
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

main()
