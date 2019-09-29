'use strict'

const LinkedList = require('yallist')

// Add the missing method that clears a list.
LinkedList.prototype.clear = function clear() {
  this.tail = null
  this.head = null
  this.length = 0
}

module.exports = LinkedList
