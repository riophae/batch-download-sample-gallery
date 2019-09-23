'use strict'

const fs = require('fs')
const path = require('path')
const chokidar = require('chokidar')
const arrayRemove = require('just-remove')
const arrayMove = require('array-move')
const writeJson = require('./write-json')

const WAITING_LIST_FILE_PATH = path.join(__dirname, '../waiting-list.json')

let waitingList = []

function initWaitingList() {
  return new Promise((resolve, reject) => {
    chokidar.watch(WAITING_LIST_FILE_PATH)
      .on('ready', () => {
        try {
          readWaitingList()
          resolve()
        } catch (error) {
          reject(error)
        }
      })
      .on('add', readWaitingList)
      .on('change', readWaitingList)
      .on('unlink', readWaitingList)
      .on('error', error => {
        console.error(error)
        process.exit(1)
      })
  })
}

function readWaitingList() {
  waitingList = []

  if (fs.existsSync(WAITING_LIST_FILE_PATH)) {
    const fileContent = fs.readFileSync(WAITING_LIST_FILE_PATH)

    if (fileContent) {
      try {
        waitingList = JSON.parse(fileContent)
      } catch (error) {
        throw new Error('Failed to read the waiting list.')
      }
    }
  }
}

function writeWaitingList(newWaitingList) {
  writeJson(WAITING_LIST_FILE_PATH, newWaitingList)
}

function getWaitingList() {
  return waitingList
}

function setWaitingList(newWaitingList) {
  waitingList = [ ...newWaitingList ]
  writeWaitingList(waitingList)
}

function isWaitingListEmpty() {
  return waitingList.length === 0
}

function isInWaitingList(galleryUrl) {
  return waitingList.includes(galleryUrl)
}

function addToWaitingList(galleryUrl) {
  if (isInWaitingList(galleryUrl)) {
    throw new Error(`Attept to add a gallery that is already in the waiting list: ${galleryUrl}`)
  }

  const newWaitingList = [ ...waitingList, galleryUrl ]

  setWaitingList(newWaitingList)
}

function removeFromWaitingList(galleryUrl) {
  if (!isInWaitingList(galleryUrl)) {
    throw new Error(`Attept to remove a gallery that is not in the waiting list: ${galleryUrl}`)
  }

  const newWaitingList = arrayRemove(waitingList, [ galleryUrl ])

  setWaitingList(newWaitingList)
}

function moveToTopOfList(galleryUrl) {
  if (!isInWaitingList(galleryUrl)) {
    throw new Error(`Attept to move a gallery to the top that is not in the waiting list: ${galleryUrl}`)
  }

  const newWaitingList = arrayMove(
    waitingList,
    waitingList.indexOf(galleryUrl),
    0,
  )

  setWaitingList(newWaitingList)
}

module.exports = {
  initWaitingList,
  getWaitingList,
  setWaitingList,
  isWaitingListEmpty,
  isInWaitingList,
  addToWaitingList,
  removeFromWaitingList,
  moveToTopOfList,
}
