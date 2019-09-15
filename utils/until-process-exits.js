'use strict'

const processExists = require('process-exists')
const sleep = require('yaku/lib/sleep')

module.exports = async pid => {
  while (await processExists(pid)) {
    await sleep(50)
  }
}
