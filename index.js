const fs = require('fs')
const path = require('path')
const update = require('log-update')
const makeDir = require('make-dir')
const prettyBytes = require('pretty-bytes')
const prettyMs = require('pretty-ms')
const leftPad = require('left-pad')
const download = require('./lib/download')
const filenamify = require('./lib/filenamify')

let title = ''
let tasks = []
let outputDir = ''
const startTime = Date.now()
let infoIntervalId
let taskIntervalId
const config = require('./lib/read-config')

function getGalleryLoader(url) {
  if (url.includes('dpreview.com')) return require('./gallery-loaders/dpreview')
  throw new Error('Unknown website')
}

function getGalleryUrl() {
  const galleryUrl = process.argv[2]
  if (!galleryUrl) throw new Error('Please specify sample gallery url.')
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
  if (pendingTask) return runTask(pendingTask)
  if (runningTasks.length === 0) done()
}

function updateInformation() {
  const runningTasks = findRunningTasks()
  const divider = `-`.repeat(80)
  const info = [ `Title: ${title}`, divider ]

  runningTasks.forEach(task => {
    const total = tasks.length
    const text = [
      'Downloading:',
      `[${leftPad(task.index, total.toString().length)}/${total}]`,
      leftPad(task.name, 16),
    ]
    const { percent, speed, time } = task.progress

    if (typeof speed === 'number') {
      text.push(leftPad(`${(percent * 100).toFixed(1)}%`, 10))
      if (speed) text.push(leftPad(`${prettyBytes(speed)}/s`, 10))
      if (time.remaining) text.push(leftPad(prettyMs(Math.max(time.remaining, 1) * 1000), 10))
    }

    info.push(text.join(' '))
  })

  update(info.join('\n'))
}

function setupRunner() {
  checkTaskState()
  updateInformation()

  taskIntervalId = setInterval(checkTaskState, 50)
  infoIntervalId = setInterval(updateInformation, 500)
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
  clearInterval(infoIntervalId)

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
