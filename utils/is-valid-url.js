'use strict'

const Url = require('url')

module.exports = input => {
  const { protocol, hostname, pathname } = Url.parse(input)

  return !!(protocol && hostname && pathname)
}
