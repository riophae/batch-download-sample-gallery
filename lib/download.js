const request = require('request')
const progress = require('request-progress')

module.exports = function download(uri) {
  const stream = progress(request(uri), { throttle: 100 })
  return stream
}
