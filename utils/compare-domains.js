'use strict'

function removeLeadingWww(domain) {
  return domain.replace(/^www\./, '')
}

module.exports = (a, b) => removeLeadingWww(a) === removeLeadingWww(b)
