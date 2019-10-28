'use strict'

const deepSeal = require('deep-seal')
const dotProp = require('dot-prop')

let globalState

const GlobalState = {
  reset() {
    globalState = deepSeal({
      galleryUrl: '',
      galleryData: {
        title: '',
        items: [],
        actualGalleryUrl: '',
      },
      aria2: {
        sessionFile: {
          path: '',
          isExisting: false,
        },
      },
      tasks: {
        data: null,
        jsonFilePath: '',
      },
      outputDir: '',
    })
  },

  get(key) {
    return dotProp.get(globalState, key)
  },

  set(key, value) {
    if (arguments.length < 2) {
      throw new Error('value is required.')
    }

    dotProp.set(globalState, key, value)
    return value
  },
}
GlobalState.reset()

module.exports = GlobalState
