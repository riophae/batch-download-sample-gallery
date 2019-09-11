'use strict'

const request = require('request-promise-native')
const readConfig = require('./read-config')

module.exports = opts => {
  const config = readConfig()
  const proxy = config.enableProxy(opts.uri || opts.url)
    ? config.proxy
    : null

  return request({ proxy, ...opts })
}
