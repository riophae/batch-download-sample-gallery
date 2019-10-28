'use strict'

const fs = require('fs')

module.exports = (jsonFilePath, object) => {
  fs.writeFileSync(
    jsonFilePath,
    JSON.stringify(object, null, 2),
  )
}
