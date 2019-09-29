'use strict'

const deepSeal = require('deep-seal')
const dotProp = require('dot-prop')

let globalState

function resetGlobalState() {
  globalState = deepSeal({
    inputGalleryUrl: '',
    galleryData: {
      title: '',
      items: [],
    },
    aria2: {
      instance: null,
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
