const path = require('path')

module.exports = {
  outputDir: path.join(__dirname, 'output'),
  enableProxy: (/* uri */) => false,
  downloadSampleMovies: false,
  proxy: 'http://127.0.0.1:9999',
  parallel: 5,
  // If not specified, a random idle port will be automatically assigned
  // port: 3456,
}
