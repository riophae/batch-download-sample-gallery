'use strict'

const u = require('url')

module.exports = url => {
  const { pathname } = u.parse(url)
  const filename = pathname.split('/').pop()

  return filename
}
