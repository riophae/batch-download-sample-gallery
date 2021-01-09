'use strict'

const test = require('ava')
const joinUrl = require('./join-url')

test('joinUrl()', t => {
  t.is(joinUrl('https://a.com/', 'b/', 'c', 'd'), 'https://a.com/b/d')
})
