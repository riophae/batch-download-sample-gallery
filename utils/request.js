'use strict'

const request = require('request-promise-native')
const Config = require('../lib/config')

module.exports = opts => {
  const { headers = {}, ...rest } = opts
  const proxy = Config.read('enableProxy')(opts.uri || opts.url)
    ? Config.read('proxy')
    : null

  if (!headers['User-Agent'] && Config.read('userAgent')) {
    headers['User-Agent'] = Config.read('userAgent')
  }

  if (opts.json) {
    headers['X-Requested-With'] = 'XMLHttpRequest'
  }

  return request({ proxy, headers, ...rest })
}
