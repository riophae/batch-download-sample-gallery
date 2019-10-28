'use strict'

const fs = require('fs')
const path = require('path')
const chokidar = require('chokidar')
const arrayRemove = require('just-remove')
const arrayMove = require('array-move')
const { loadGallery, createHashForUrl } = require('../adapters')
const writeJsonFile = require('../utils/write-json-file')

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
    writeJsonFile(WAITING_LIST_FILE_PATH, newWaitingList)
  },

  _findEntry(galleryUrl) {
    const hash = createHashForUrl(galleryUrl)

    return waitingList.find(entry => entry.hash === hash)
  },

  _findIndex(galleryUrl) {
    const hash = createHashForUrl(galleryUrl)

    return waitingList.findIndex(entry => entry.hash === hash)
  },

  getCurrent() {
    return waitingList[0]
  },

  getRest() {
    return waitingList.slice(1)
  },

  set(newWaitingList) {
    waitingList = [ ...newWaitingList ]
    WaitingList._write(waitingList)
  },

  isEmpty() {
    return waitingList.length === 0
  },

  isInList(galleryUrl) {
    return WaitingList._findIndex(galleryUrl) !== -1
  },

  async add(galleryUrl) {
    if (WaitingList.isInList(galleryUrl)) {
      throw new Error(`Attept to add a gallery that is already in the waiting list: ${galleryUrl}`)
    }

    const galleryData = await loadGallery(galleryUrl)
    const hash = createHashForUrl(galleryUrl)
    const entry = {
      hash,
      galleryUrl,
      galleryData,
    }
    const newWaitingList = [ ...waitingList, entry ]

    WaitingList.set(newWaitingList)
  },

  remove(galleryUrl) {
    if (!WaitingList.isInList(galleryUrl)) {
      throw new Error(`Attept to remove a gallery that is not in the waiting list: ${galleryUrl}`)
    }

    const entry = WaitingList._findEntry(galleryUrl)
    const newWaitingList = arrayRemove(waitingList, [ entry ])

    WaitingList.set(newWaitingList)
  },

  moveToTop(galleryUrl) {
    if (!WaitingList.isInList(galleryUrl)) {
      throw new Error(`Attept to move a gallery to the top that is not in the waiting list: ${galleryUrl}`)
    }

    const oldIndex = WaitingList._findIndex(galleryUrl)
    const newWaitingList = arrayMove(
      waitingList,
      oldIndex,
      0,
    )

    WaitingList.set(newWaitingList)
  },
}

module.exports = WaitingList
