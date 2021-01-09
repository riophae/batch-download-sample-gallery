'use strict'

function joinUrl(...parts) {
  const [ a, b, ...rest ] = parts
  const c = new URL(b, a).href

  return rest.length ? joinUrl(c, ...rest) : c
}

module.exports = joinUrl
