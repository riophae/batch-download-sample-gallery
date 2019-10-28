'use strict'

const Url = require('url')

module.exports = url => {
  const { pathname } = Url.parse(url)
  const filename = pathname.split('/').pop()

  return filename
}
