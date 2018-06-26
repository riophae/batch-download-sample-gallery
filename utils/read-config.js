const fs = require('fs')
const path = require('path')

const userConfigPath = path.join(__dirname, '../config.js')
const defaultConfigPath = path.join(__dirname, '../config.default.js')
const userConfig = fs.existsSync(userConfigPath) ? require(userConfigPath) : {}
const defaultConfig = require(defaultConfigPath)

module.exports = { ...defaultConfig, ...userConfig }
