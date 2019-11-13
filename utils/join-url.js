'use strict'

const Url = require('url')

function joinUrl(...parts) {
  const [ a, b, ...rest ] = parts
  const c = Url.resolve(a, b)

  return rest.length ? joinUrl(c, ...rest) : c
}

module.exports = joinUrl
