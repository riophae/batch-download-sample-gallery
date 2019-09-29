/* eslint-disable no-unused-vars */
/* eslint-disable no-console */

'use strict'

const sleep = require('yaku/lib/sleep')
const SpeedAnalyzer = require('./speed-analyzer')

async function test1(asc) {
  let i = 0

  while (i++ < 24) {
    asc.add({ downloadSpeed: 1000 })
    await sleep(500)
  }
}

async function test2(asc) {
  let i = 0

  while (i++ < 24) {
    asc.add({ downloadSpeed: Math.random() * 1000 })
    await sleep(500)
  }
}

async function test3(asc) {
  let i = 0

  while (i++ < 5) {
    asc.add({ downloadSpeed: Math.random() * 1000 })
    await sleep(500)
  }
}

async function test4(asc) {
  let i = 0

  while (i++ < 24) {
    asc.add({ downloadSpeed: Math.random() * 1000 })
    await sleep(1100)
  }
}

async function test() {
  const asc = new SpeedAnalyzer()

  await test1(asc)

  console.log(asc.hasEnoughSamples())
  console.log(asc.getAverageDownloadSpeed())
}
test()
