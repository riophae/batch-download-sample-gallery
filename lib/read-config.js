const fs = require('fs')
const path = require('path')

const userConfigPath = path.join(__dirname, '../config.js')
const defaultConfigPath = path.join(__dirname, '../config.default.js')

module.exports = fs.existsSync(userConfigPath)
  ? require(userConfigPath)
  : require(defaultConfigPath)
