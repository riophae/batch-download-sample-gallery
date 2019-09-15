'use strict'

const deepSeal = require('deep-seal')
const dotProp = require('dot-prop')

const globalState = deepSeal({
  config: require('./read-config')(),
  galleryUrl: '',
  galleryData: {},
  displayTitle: '',
  aria2: {
    instance: null,
    port: -1,
    session: {
      filePath: '',
      isExists: false,
    },
  },
  tasks: {
    data: null,
    jsonFilePath: '',
  },
  outputDir: '',
})

function getGlobalState(key) {
  return dotProp.get(globalState, key)
}

function setGlobalState(key, value) {
  dotProp.set(globalState, key, value)
  return value
}

module.exports = {
  getGlobalState,
  setGlobalState,
}
