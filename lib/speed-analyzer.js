'use strict'

const LinkedList = require('../utils/linked-list')

class TimeSlot {
  constructor({ downloadSpeed, completedLength }) {
    this.time = Date.now()
    this.downloadSpeed = downloadSpeed
    this.completedLength = completedLength
  }
}

class SpeedAnalyzer {
  constructor(opts) {
    const { windowTime, maxGapBetweenTimeSlots } = opts || {}

    this._list = new LinkedList()
    this._windowTime = windowTime || 10 * 1000
    this._maxGapBetweenSamples = maxGapBetweenTimeSlots || 1000
  }

  get _hasData() {
    return this._list.length > 0
  }

  get _head() {
    return this._hasData
      ? this._list.head.value
      : null
  }

  get _tail() {
    return this._hasData
      ? this._list.tail.value
      : null
  }

  _removeStaleTimeSlots() {
    if (this._hasData) {
      if (this._isGapTooWide(this._tail.time, Date.now())) {
        this.clear()
      } else {
        while (this._hasData && !this._isInTimeWindow(this._head)) {
          this._list.shift()
        }
      }
    }
  }

  _isInTimeWindow(ts) {
    return Date.now() - ts.time <= this._windowTime
  }

  _isGapTooWide(a, b) {
    return Math.abs(a - b) > this._maxGapBetweenSamples
  }

  add({ downloadSpeed, completedLength }) {
    const ts = new TimeSlot({ downloadSpeed, completedLength })

    this._removeStaleTimeSlots()
    this._list.push(ts)
  }

  clear() {
    this._list.clear()
  }

  hasEnoughSamples() {
    const timeSlots = this._list.toArray()
    let lastTime = Date.now()

    while (timeSlots.length > 0) {
      const ts = timeSlots.pop()

      if (this._isGapTooWide(ts.time, lastTime)) {
        return false
      }

      if (!this._isInTimeWindow(ts)) {
        return true
      }

      lastTime = ts.time
    }

    return false
  }

  getAverageDownloadSpeed() {
    if (!this.hasEnoughSamples()) {
      return Number.NaN
    }

    const timeSlots = this._list.toArray().filter(ts => this._isInTimeWindow(ts))
    const start = timeSlots.shift()
    const end = timeSlots.pop()
    const downloadedLength = end.completedLength - start.completedLength
    const duration = (end.time - start.time) / 1000
    const averageSpeed = downloadedLength / duration

    return averageSpeed
  }
}

module.exports = SpeedAnalyzer
