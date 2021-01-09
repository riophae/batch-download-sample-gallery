'use strict'

module.exports = input => {
  const { protocol, hostname, pathname } = new URL(input)

  return !!(protocol && hostname && pathname)
}
