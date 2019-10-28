'use strict'

const xbytes = require('xbytes')

module.exports = value => xbytes(value, { iec: true })
