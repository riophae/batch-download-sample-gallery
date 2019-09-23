'use strict'

const deepSeal = require('deep-seal')
const dotProp = require('dot-prop')

let globalState

function resetGlobalState() {
  // TODO: 恢复 port
  globalState = deepSeal({
    inputGalleryUrl: '',
    galleryData: {
      title: '',
      items: [],
    },
    displayTitle: '',
    aria2: {
      instance: null,
      port: -1,
      session: {
        filePath: '',
        isExists: false,
      },
      referer: '',
    },
    tasks: {
      data: null,
      jsonFilePath: '',
    },
    outputDir: '',
  })
}
resetGlobalState()

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
  resetGlobalState,
}
