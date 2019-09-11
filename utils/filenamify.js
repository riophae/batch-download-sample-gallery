'use strict'

const filenamify = require('filenamify')

module.exports = name => filenamify(name, { replacement: ' ' })
