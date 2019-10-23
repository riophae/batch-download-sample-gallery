'use strict'

const fs = require('fs')
const path = require('path')
const deepmerge = require('deepmerge')
const dotProp = require('dot-prop')

let config

const Config = {
  _init() {
    const userConfigPath = path.join(__dirname, '../config.js')
    const defaultConfigPath = path.join(__dirname, '../config.default.js')
    const userConfig = fs.existsSync(userConfigPath) ? require(userConfigPath) : {}
    const defaultConfig = require(defaultConfigPath)

    config = deepmerge(defaultConfig, userConfig)
  },

  read(key) {
    return dotProp.get(config, key)
  },
}
Config._init()

module.exports = Config
