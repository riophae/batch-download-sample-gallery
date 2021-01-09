'use strict'

module.exports = url => {
  const { pathname } = new URL(url)
  const filename = pathname.split('/').pop()

  return filename
}
