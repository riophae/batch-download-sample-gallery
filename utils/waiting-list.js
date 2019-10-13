'use strict'

const fs = require('fs')
const path = require('path')
const chokidar = require('chokidar')
const arrayRemove = require('just-remove')
const arrayMove = require('array-move')
const writeJson = require('./write-json')

const WAITING_LIST_FILE_PATH = path.join(__dirname, '../waiting-list.json')

let waitingList = []

const WaitingList = {
  init() {
    return new Promise((resolve, reject) => {
      chokidar.watch(WAITING_LIST_FILE_PATH)
        .on('ready', () => {
          try {
            WaitingList._read()
            resolve()
          } catch (error) {
            reject(error)
          }
        })
        .on('add', WaitingList._read)
        .on('change', WaitingList._read)
        .on('unlink', WaitingList._read)
        .on('error', error => {
          console.error(error)
          process.exit(1)
        })
    })
  },

  _read() {
    waitingList = []

    if (fs.existsSync(WAITING_LIST_FILE_PATH)) {
      const fileContent = fs.readFileSync(WAITING_LIST_FILE_PATH)

      if (fileContent) {
        try {
          waitingList = JSON.parse(fileContent)
        } catch (error) {
          console.error(error)
          throw new Error('Failed to read the waiting list.')
        }
      }
    }
  },

  _write(newWaitingList) {
    writeJson(WAITING_LIST_FILE_PATH, newWaitingList)
  },

  get() {
    return waitingList
  },

  set(newWaitingList) {
    waitingList = [ ...newWaitingList ]
    WaitingList._write(waitingList)
  },

  isEmpty() {
    return waitingList.length === 0
  },

  isInList(galleryUrl) {
    return waitingList.includes(galleryUrl)
  },

  add(galleryUrl) {
    if (WaitingList.isInList(galleryUrl)) {
      throw new Error(`Attept to add a gallery that is already in the waiting list: ${galleryUrl}`)
    }

    const newWaitingList = [ ...waitingList, galleryUrl ]

    WaitingList.set(newWaitingList)
  },

  remove(galleryUrl) {
    if (!WaitingList.isInList(galleryUrl)) {
      throw new Error(`Attept to remove a gallery that is not in the waiting list: ${galleryUrl}`)
    }

    const newWaitingList = arrayRemove(waitingList, [ galleryUrl ])

    WaitingList.set(newWaitingList)
  },

  moveToTop(galleryUrl) {
    if (!WaitingList.isInList(galleryUrl)) {
      throw new Error(`Attept to move a gallery to the top that is not in the waiting list: ${galleryUrl}`)
    }

    const newWaitingList = arrayMove(
      waitingList,
      waitingList.indexOf(galleryUrl),
      0,
    )

    WaitingList.set(newWaitingList)
  },
}

module.exports = WaitingList
