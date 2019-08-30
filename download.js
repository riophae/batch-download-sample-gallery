const path = require('path')
const chalk = require('chalk')
const ProgressBarFormatter = require('progress-bar-formatter')
const update = require('log-update')
const makeDir = require('make-dir')
const prettyBytes = require('pretty-bytes')
const prettyMs = require('pretty-ms')
const leftPad = require('left-pad')
const startAria2 = require('./utils/start-aria2')
const filenamify = require('./utils/filenamify')
const readConfig = require('./utils/read-config')

const config = readConfig()
let galleryData
let title = ''
let aria2
let port
const tasks = Object.create(null)
let outputDir = ''
const startTime = Date.now()
let progressIntervalId
const bar = new ProgressBarFormatter({
  complete: '=',
  incomplete: ' ',
  length: 18,
})

function getGalleryLoader(url) {
  if (url.includes('dpreview.com')) return require('./gallery-loaders/dpreview')
  if (url.includes('imaging-resource.com')) return require('./gallery-loaders/imaging-resource')
  if (url.includes('photographyblog.com')) return require('./gallery-loaders/photography-blog')
  if (url.includes('dcfever.com')) return require('./gallery-loaders/dcfever')
  throw new Error('Unknown website')
}

function getGalleryUrlFromCLI() {
  const galleryUrl = process.argv[2]

  if (!galleryUrl) {
    throw new Error('Please specify the sample gallery url.')
  }

  return galleryUrl
}

async function getGalleryData(galleryUrl) {
  update('Fetching gallery data...')

  const galleryLoader = getGalleryLoader(galleryUrl)
  galleryData = await galleryLoader(galleryUrl)
}

async function prepare() {
  title = chalk.bold('Gallery: ' + galleryData.title)
  outputDir = path.join(config.outputDir, filenamify(galleryData.title));
  [ aria2, port ] = await startAria2()

  await makeDir(outputDir)
}

async function createTasks() {
  const { items, galleryUrl } = galleryData

  for (let i = 0, l = items.length; i < l; i++) {
    const item = items[i]
    const filename = filenamify(item.name)
    const proxyEnabled = config.enableProxy(item.url)
    const gid = await aria2.call('addUri', [ item.url ], {
      'dir': outputDir,
      'out': filename,
      'referer': galleryUrl,
      'all-proxy': proxyEnabled
        ? config.aria2.proxy
        : null,
    })

    tasks[gid] = {
      index: i + 1,
      filename,
      proxyEnabled,
    }
  }
}

async function checkProgress() {
  const activeDownloads = await aria2.call('tellActive')
  const globalStat = await aria2.call('getGlobalStat')
  const info = [ title, '' ]

  if (!Number(globalStat.numActive) && !Number(globalStat.numWaiting)) {
    return done()
  }

  activeDownloads.forEach(download => {
    const task = tasks[download.gid]
    const total = galleryData.items.length
    const totalLength = Number(download.totalLength)
    const completedLength = Number(download.completedLength)
    const downloadSpeed = Number(download.downloadSpeed)
    const percent = completedLength / totalLength || 0
    const remaining = downloadSpeed
      ? (1 - percent) * completedLength / downloadSpeed * 1000
      : NaN
    const proxyIndicator = chalk.red(task.proxyEnabled ? '*' : ' ')

    const text = [
      chalk.gray('Downloading:'),
      chalk.green(`[${leftPad(task.index, total.toString().length)}/${total}]`),
      '[' + chalk.gray(bar.format(percent)) + ']',
      leftPad(totalLength ? prettyBytes(totalLength) : '', 12),
      leftPad(downloadSpeed ? `${prettyBytes(downloadSpeed)}/s` : '', 12),
      leftPad(remaining ? prettyMs(remaining) : '', 12),
      chalk.cyan(task.filename) + proxyIndicator,
    ]

    info.push(text.join(' '))
  })

  info.push(
    '',
    `Overall speed: ${prettyBytes(Number(globalStat.downloadSpeed))}/s`,
    `aria2 RPC interface is listening at http://localhost:${port}/jsonrpc (no secret token)`,
  )

  update(info.join('\n'))
}

function setupRunner() {
  checkProgress()

  progressIntervalId = setInterval(checkProgress, 1000)
}

function done() {
  clearInterval(progressIntervalId)
  aria2.close()

  const diff = prettyMs(Date.now() - startTime)
  update([ title, '', `All tasks done in ${diff}.` ].join('\n'))

  process.exit(0)
}

async function main() {
  try {
    const galleryUrl = getGalleryUrlFromCLI()
    await getGalleryData(galleryUrl)
    await prepare()
    await createTasks()
    setupRunner()
  } catch (err) {
    console.error(err)
  }
}

main()
