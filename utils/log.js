'use strict'

const fs = require('fs')
const path = require('path')
const timestamp = require('tinydate')('[{MM}/{DD}-{HH}:{mm}:{ss}]')

// TODO

const LOG_FILE_PATH = path.join(__dirname, '../log')

let logText = ''

function init() {
  if (fs.existsSync(LOG_FILE_PATH)) {
    logText = read()
  }
}
init()

function read() {
  return fs.readFileSync(LOG_FILE_PATH)
}

function write() {
  fs.writeFileSync(LOG_FILE_PATH, logText)
}

function log(message) {
  logText += timestamp() + ' ' + message + '\n'
  write()
}

module.exports = log
