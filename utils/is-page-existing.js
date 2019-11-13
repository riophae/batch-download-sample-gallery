'use strict'

const request = require('../utils/request')

module.exports = async url => {
  try {
    await request({ url, method: 'HEAD' })
    return true
  } catch (error) {
    if (error.statusCode === 404) {
      return false
    }

    throw error
  }
}
