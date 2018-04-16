const fs = require('fs')
const path = require('path')
const update = require('log-update')
const makeDir = require('make-dir')
const prettyBytes = require('pretty-bytes')
const prettyMs = require('pretty-ms')
const download = require('./lib/download')
const filenamify = require('./lib/filenamify')

let title = ''
let tasks = []
let outputDir = ''
const startTime = Date.now()
let hudIntervalId
let taskIntervalId
const config = require('./lib/read-config')

function getGalleryLoader(url) {
  if (!url) throw new Error('No url provided')
  if (url.includes('dpreview.com')) return require('./gallery-loaders/dpreview')
  throw new Error('Unknown')
}

function getGalleryUrl() {
  const galleryUrl = process.argv[2]
  if (!galleryUrl) throw new Error('Please specify gallery url.')
  return galleryUrl
}

async function getGalleryData(galleryUrl) {
  update('Fetching gallery data...')

  const galleryLoader = getGalleryLoader(galleryUrl)
  const galleryData = await galleryLoader(galleryUrl)

  return galleryData
}

async function prepare(galleryData) {
  title = galleryData.title
  outputDir = path.join(__dirname, 'output', filenamify(title))

  await makeDir(outputDir)
}

function createTasks(galleryData) {
  tasks = galleryData.items.map((item, index) => ({
    index: index + 1,
    name: item.name,
    url: item.url,
    completed: false,
    running: false,
    progress: {},
  }))
}

function findRunningTasks() {
  return tasks.filter(task => task.running)
}

function findPendingTask() {
  return tasks.find(task => !task.completed && !task.running)
}

function checkTaskState() {
  const runningTasks = findRunningTasks()
  if (runningTasks.length === config.parallel) return
  const pendingTask = findPendingTask()
  if (!pendingTask) return done()
  runTask(pendingTask)
}

function updateHudInformation() {
  const runningTasks = findRunningTasks()
  const divider = `-`.repeat(80)
  const info = [ `Title: ${title}`, divider ]

  runningTasks.forEach(task => {
    const text = [ `Downloading[${task.index}/${tasks.length}]: ${task.name}` ]
    const { percent, speed, time } = task.progress
    if (typeof speed === 'number') {
      text.push(
        `${(percent * 100).toFixed(1)}%`,
        speed ? `${prettyBytes(speed)}/s` : '',
        time.remaining ? prettyMs(time.remaining * 1000) : '',
      )
    }
    info.push(text.join(' '))
  })

  update(info.join('\n'))
}

function setupRunner() {
  checkTaskState()
  updateHudInformation()

  taskIntervalId = setInterval(checkTaskState, 50)
  hudIntervalId = setInterval(updateHudInformation, 500)
}

function runTask(task) {
  const outputPath = path.join(outputDir, filenamify(task.name))
  const downloadStream = download(task.url)
  const writeStream = fs.createWriteStream(outputPath)

  downloadStream.on('progress', progress => {
    task.progress = progress
  })
  downloadStream.on('error', error => {
    throw error
  })
  downloadStream.on('end', () => {
    task.progress.percent = 1
    task.progress.speed = 0
    task.progress.time.remaining = 0

    setTimeout(() => {
      task.completed = true
      task.running = false
    }, 1000)
  })
  downloadStream.pipe(writeStream)

  task.running = true
}

function done() {
  clearInterval(taskIntervalId)
  clearInterval(hudIntervalId)

  const diff = prettyMs(Date.now() - startTime)
  update(`All tasks done in ${diff}.`)
}

async function main() {
  try {
    const galleryUrl = getGalleryUrl()
    const galleryData = await getGalleryData(galleryUrl)
    await prepare(galleryData)
    createTasks(galleryData)
    setupRunner()
  } catch (err) {
    console.error(err)
  }
}

main()
