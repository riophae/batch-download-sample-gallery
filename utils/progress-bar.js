'use strict'

const ProgressBarFormatter = require('progress-bar-formatter')

module.exports = new ProgressBarFormatter({
  complete: '=',
  incomplete: ' ',
  length: 18,
})
