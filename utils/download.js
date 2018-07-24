const request = require('request')
const progress = require('request-progress')
const config = require('./read-config')

module.exports = function download(uri, opts = {}) {
  const proxy = config.enableProxy(uri) ? config.proxy : null
  const req = request({ uri, proxy, ...opts })
  const stream = progress(req, { throttle: 100 })
  return stream
}
