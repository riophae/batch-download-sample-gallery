const path = require('path')

module.exports = {
  outputDir: path.join(__dirname, 'output'),
  downloadSampleMovies: false,
  enableProxy: (/* uri */) => false,
  aria2: {
    // If not specified, a random idle port will be automatically assigned
    // port: 3456,
    parallel: 5,
    proxy: 'http://127.0.0.1:9999',
  },
}
