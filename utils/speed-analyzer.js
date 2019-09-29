'use strict'

const LinkedList = require('./linked-list')

const WINDOW_TIME = 10 * 1000
const MAX_GAP_BETWEEN_TIME_SLOTS = 1000

class TimeSlot {
  constructor({ downloadSpeed, completedLength }) {
    this.time = Date.now()
    this.downloadSpeed = downloadSpeed
    this.completedLength = completedLength
  }
}

class SpeedAnalyzer {
  constructor() {
    this._list = new LinkedList()
    this._hasEnoughSamples = false
  }

  _clear() {
    this._list.clear()
    this._hasEnoughSamples = false
  }

  _removeStaleTimeSlots() {
    const now = Date.now()
    const list = this._list

    while (list.length && now - list.head.value.time > WINDOW_TIME) {
      list.shift()
    }
  }

  add({ downloadSpeed, completedLength }) {
    const ts = new TimeSlot({ downloadSpeed, completedLength })
    const list = this._list

    if (list.length > 0) {
      if (ts.time - list.tail.value.time > MAX_GAP_BETWEEN_TIME_SLOTS) {
        this._clear()
      } else if (ts.time - list.head.value.time > (WINDOW_TIME + MAX_GAP_BETWEEN_TIME_SLOTS / 10)) {
        this._hasEnoughSamples = true
        this._removeStaleTimeSlots()
      }
    }

    list.push(ts)
  }

  hasEnoughSamples() {
    return this._hasEnoughSamples
  }

  getAverageDownloadSpeed() {
    const now = Date.now()
    const timeSlots = [ ...this._list ].filter(ts => now - ts.time <= WINDOW_TIME)
    const num = timeSlots.length
    const average = timeSlots.reduce(
      (sum, ts) => sum + (ts.downloadSpeed / num),
      0,
    )

    return average
  }
}

module.exports = SpeedAnalyzer
