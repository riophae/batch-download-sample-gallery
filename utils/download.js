const request = require('request')
const progress = require('request-progress')
const config = require('./read-config')

module.exports = function download(uri) {
  const req = request({
    uri,
    proxy: config.enableProxy ? config.proxy : null,
  })
  const stream = progress(req, { throttle: 100 })
  return stream
}
