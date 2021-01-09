'use strict'

const chalk = require('chalk')
const ProgressBarFormatter = require('progress-bar-formatter')

module.exports = new ProgressBarFormatter({
  complete: '=',
  incomplete: chalk.grey('.'),
  length: 18,
})
