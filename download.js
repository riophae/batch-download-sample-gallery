const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const ProgressBarFormatter = require('progress-bar-formatter')
const update = require('log-update')
const makeDir = require('make-dir')
const prettyBytes = require('pretty-bytes')
const prettyMs = require('pretty-ms')
const leftPad = require('left-pad')
const download = require('./utils/download')
const filenamify = require('./utils/filenamify')
const config = require('./utils/read-config')

let galleryData
let title = ''
let tasks = []
let outputDir = ''
const startTime = Date.now()
let infoIntervalId
let taskIntervalId
const tasksDataFile = path.join(__dirname, 'tasks.json')
const bar = new ProgressBarFormatter({
  complete: '=',
  incomplete: ' ',
  length: 18,
})

function getGalleryLoader(url) {
  if (url.includes('dpreview.com')) return require('./gallery-loaders/dpreview')
  if (url.includes('imaging-resource.com')) return require('./gallery-loaders/imaging-resource')
  if (url.includes('photographyblog.com')) return require('./gallery-loaders/photography-blog')
  throw new Error('Unknown website')
}

function getGalleryUrlFromCLA(ignoreEmpty) {
  const galleryUrl = process.argv[2]
  if (!galleryUrl && !ignoreEmpty) {
    throw new Error('Please specify sample gallery url.')
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
  outputDir = path.join(__dirname, 'output', filenamify(galleryData.title))

  await makeDir(outputDir)
}

function createTasks() {
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
  const info = [ title, '' ]

  runningTasks.forEach(task => {
    const total = tasks.length
    const { percent, speed, size, time } = task.progress
    const text = [
      chalk.gray('Downloading:'),
      chalk.green(`[${leftPad(task.index, total.toString().length)}/${total}]`),
      '[' + chalk.gray(bar.format(percent || 0)) + ']',
      leftPad(size && size.total ? prettyBytes(size.total) : '', 12),
      leftPad(speed ? `${prettyBytes(speed)}/s` : '', 12),
      leftPad(time && time.remaining ? prettyMs(Math.max(time.remaining, 1) * 1000) : '', 12),
      chalk.cyan(task.name),
    ]

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
  const downloadStream = download(task.url, {
    headers: {
      Referer: galleryData.galleryUrl,
    },
  })
  const writeStream = fs.createWriteStream(outputPath)
  const retryTask = () => runTask(task)

  downloadStream.on('progress', progress => {
    task.progress = progress
  })
  downloadStream.on('error', error => {
    console.error(error)
    setTimeout(retryTask, 3000)
  })
  downloadStream.on('end', () => {
    task.progress.percent = 1
    task.progress.speed = 0
    if (task.progress.time) task.progress.time.remaining = 0

    setTimeout(() => {
      task.completed = true
      task.running = false
      saveUnfinishedTasks()
    }, 1000)
  })

  downloadStream.pipe(writeStream)
  task.running = true
}

function markCompletedTasks(savedTasks) {
  savedTasks.forEach(savedTask => {
    const matchedTask = tasks.find(task => task.name === savedTask.name)
    if (matchedTask) matchedTask.completed = savedTask.completed
  })
}

function loadUnfinishedTasks() {
  if (fs.existsSync(tasksDataFile)) {
    return require(tasksDataFile)
  }
}

function saveUnfinishedTasks() {
  const unfinishedTasksData = { galleryData, tasks }
  fs.writeFileSync(tasksDataFile, JSON.stringify(unfinishedTasksData))
}

function removeTasksDataFile() {
  if (fs.existsSync(tasksDataFile)) {
    fs.unlinkSync(tasksDataFile)
  }
}

function done() {
  clearInterval(taskIntervalId)
  clearInterval(infoIntervalId)

  const diff = prettyMs(Date.now() - startTime)
  update([ title, '', `All tasks done in ${diff}.` ].join('\n'))
  removeTasksDataFile()
}

async function main() {
  try {
    const unfinishedTasksData = await loadUnfinishedTasks()

    if (unfinishedTasksData) {
      const { galleryData: { galleryUrl }, tasks: savedTasks } = unfinishedTasksData
      const galleryUrl_ = getGalleryUrlFromCLA(true)
      if (galleryUrl_ && galleryUrl !== galleryUrl_) {
        throw new Error('Please check out unfinished tasks first.')
      }
      await getGalleryData(galleryUrl)
      await prepare(galleryData)
      createTasks()
      markCompletedTasks(savedTasks)
    } else {
      const galleryUrl = getGalleryUrlFromCLA()
      await getGalleryData(galleryUrl)
      await prepare(galleryData)
      createTasks()
    }

    setupRunner()
  } catch (err) {
    console.error(err)
  }
}

main()
