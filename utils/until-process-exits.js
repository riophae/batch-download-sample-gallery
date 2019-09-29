'use strict'

const processExists = require('process-exists')
const sleep = require('p-sleep')

module.exports = async pid => {
  while (await processExists(pid)) {
    await sleep(50)
  }
}
