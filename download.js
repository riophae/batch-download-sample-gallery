const fs = require('fs')
const path = require('path')
const update = require('log-update')
const makeDir = require('make-dir')
const prettyBytes = require('pretty-bytes')
const prettyMs = require('pretty-ms')
const leftPad = require('left-pad')
const download = require('./lib/download')
const filenamify = require('./lib/filenamify')
const config = require('./lib/read-config')

let galleryData
let title = ''
let tasks = []
let outputDir = ''
const startTime = Date.now()
let infoIntervalId
let taskIntervalId
const divider = `-`.repeat(80)
const tasksDataFile = path.join(__dirname, 'tasks.json')

function getGalleryLoader(url) {
  if (url.includes('dpreview.com')) return require('./gallery-loaders/dpreview')
  if (url.includes('imaging-resource.com')) return require('./gallery-loaders/imaging-resource')
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
  title = 'Gallery: ' + galleryData.title
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
  const info = [ title, divider ]

  runningTasks.forEach(task => {
    const total = tasks.length
    const text = [
      'Downloading:',
      `[${leftPad(task.index, total.toString().length)}/${total}]`,
      leftPad(task.name, 16),
    ]
    const { percent, speed, size, time } = task.progress

    if (typeof speed === 'number') {
      if (size && size.total) text.push(leftPad(prettyBytes(size.total), 10))
      text.push(leftPad(`${(percent * 100).toFixed(1)}%`, 10))
      if (speed) text.push(leftPad(`${prettyBytes(speed)}/s`, 10))
      if (time && time.remaining) text.push(leftPad(prettyMs(Math.max(time.remaining, 1) * 1000), 10))
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
  update([ title, divider, `All tasks done in ${diff}.` ].join('\n'))
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
