'use strict'

const request = require('request-promise-native')
const { getGlobalState } = require('./global-state')

module.exports = opts => {
  const config = getGlobalState('config')
  const proxy = config.enableProxy(opts.uri || opts.url)
    ? config.proxy
    : null

  return request({ proxy, ...opts })
}
