'use strict'

const path = require('path')

module.exports = {
  outputDir: path.join(__dirname, 'output'),
  downloadSampleMovies: false,
  enableProxy: (/* uri */) => false,
  proxy: 'http://127.0.0.1:9999',
  aria2: {
    // If not specified, a random idle port will be automatically assigned
    // port: 3456,
    concurrent: 3,
    split: 1,
  },
}
