'use strict'

const request = require('request-promise-native')
const { readConfig } = require('./config')

module.exports = opts => {
  const proxy = readConfig('enableProxy')(opts.uri || opts.url)
    ? readConfig('proxy')
    : null

  return request({ proxy, ...opts })
}
