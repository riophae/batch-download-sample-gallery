'use strict'

const fs = require('fs')
const path = require('path')
const deepmerge = require('deepmerge')
const dotProp = require('dot-prop')

let config

function initConfig() {
  const userConfigPath = path.join(__dirname, '../config.js')
  const defaultConfigPath = path.join(__dirname, '../config.default.js')
  const userConfig = fs.existsSync(userConfigPath) ? require(userConfigPath) : {}
  const defaultConfig = require(defaultConfigPath)

  config = deepmerge(defaultConfig, userConfig)
}
initConfig()

function readConfig(key) {
  return dotProp.get(config, key)
}

module.exports = {
  readConfig,
}
