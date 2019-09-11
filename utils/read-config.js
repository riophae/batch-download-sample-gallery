'use strict'

const fs = require('fs')
const path = require('path')
const deepmerge = require('deepmerge')

const userConfigPath = path.join(__dirname, '../config.js')
const defaultConfigPath = path.join(__dirname, '../config.default.js')
const userConfig = fs.existsSync(userConfigPath) ? require(userConfigPath) : {}
const defaultConfig = require(defaultConfigPath)
const finalConfig = deepmerge(defaultConfig, userConfig)

module.exports = function readConfig() {
  return finalConfig
}
