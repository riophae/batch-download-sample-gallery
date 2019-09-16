'use strict'

const { parse: parseUrl } = require('url')

module.exports = input => {
  const { protocol, hostname, pathname } = parseUrl(input)

  return !!(protocol && hostname && pathname)
}
