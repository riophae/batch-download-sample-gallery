'use strict'

let startTime

const GlobalStopwatch = {
  _init() {
    startTime = Date.now()
  },

  tell() {
    return Date.now() - startTime
  },
}
GlobalStopwatch._init()

module.exports = GlobalStopwatch
