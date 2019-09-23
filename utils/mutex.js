'use strict'

const fs = require('fs')
const path = require('path')
const exitHook = require('exit-hook')

const LOCK_FILE_PATH = path.join(__dirname, '../lock')

function isMutexLocked() {
  return fs.existsSync(LOCK_FILE_PATH)
}

function lockMutex() {
  if (isMutexLocked()) {
    throw new Error('Attempt to lock mutex that is already locked.')
  }

  fs.writeFileSync(LOCK_FILE_PATH, '')
  exitHook(releaseMutex)
}

function releaseMutex() {
  if (!isMutexLocked()) {
    throw new Error('Attempt to release mutex that was not locked.')
  }

  fs.unlinkSync(LOCK_FILE_PATH)
}

module.exports = {
  isMutexLocked,
  lockMutex,
  releaseMutex,
}
