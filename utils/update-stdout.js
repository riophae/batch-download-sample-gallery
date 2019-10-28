'use strict'

const logUpdate = require('log-update')

module.exports = lines => {
  const message = Array.isArray(lines) ? lines.join('\n') : lines

  logUpdate(message.trim())
}
