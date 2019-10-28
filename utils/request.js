'use strict'

const request = require('request-promise-native')
const Config = require('../libs/config')

module.exports = opts => {
  const proxy = Config.read('enableProxy')(opts.uri || opts.url)
    ? Config.read('proxy')
    : null

  return request({ proxy, ...opts })
}
