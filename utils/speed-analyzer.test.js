/* eslint-disable no-console */

'use strict'

const test = require('ava')
const sleep = require('p-sleep')
const inRange = require('lodash/inRange')
const SpeedAnalyzer = require('./speed-analyzer')

async function run(speedAnalyzer, times, speedFn, interval) {
  let i = 0
  let accumulated = 0
  let lastTime = Date.now() - interval

  while (i++ < times) {
    const speed = speedFn()
    const timeActuallyPassed = Date.now() - lastTime
    const increment = speed * (timeActuallyPassed / 1000)

    speedAnalyzer.add({
      downloadSpeed: speed,
      completedLength: accumulated + increment,
    })

    accumulated += increment
    lastTime = Date.now()

    await sleep(interval)
  }
}

function isSpeedRoughlyEqual(actual, expected) {
  return Math.abs(actual - expected) / expected < 0.01
}

test('most basic', async t => {
  const windowTime = 2000
  const interval = 50
  const maxGapBetweenTimeSlots = Math.round(interval * 1.5)
  const times = Math.round(windowTime / interval) + 1
  const speedAnalyzer = new SpeedAnalyzer({
    windowTime,
    maxGapBetweenTimeSlots,
  })
  const speed = 1000

  await run(
    speedAnalyzer,
    times,
    () => speed,
    interval,
  )

  t.true(speedAnalyzer.hasEnoughSamples())
  t.true(
    isSpeedRoughlyEqual(speed, speedAnalyzer.getAverageDownloadSpeed()),
    `Actual speed: ${speedAnalyzer.getAverageDownloadSpeed()} / Expected speed: ${speed}`,
  )
})

test('variable speed', async t => {
  const windowTime = 2000
  const interval = 50
  const maxGapBetweenTimeSlots = Math.round(interval * 1.5)
  const times = Math.round(windowTime / interval) + 1
  const speedAnalyzer = new SpeedAnalyzer({
    windowTime,
    maxGapBetweenTimeSlots,
  })
  const maxSpeed = 1000

  await run(
    speedAnalyzer,
    times,
    () => maxSpeed * Math.random(),
    interval,
  )

  const averageSpeed = speedAnalyzer.getAverageDownloadSpeed()

  t.true(speedAnalyzer.hasEnoughSamples())
  t.true(
    inRange(averageSpeed, 0, maxSpeed),
    `Actual average speed ${averageSpeed} is not in range (0, ${maxSpeed})`,
  )
})

test('insufficient samples', async t => {
  const windowTime = 2000
  const interval = 50
  const maxGapBetweenTimeSlots = Math.round(interval * 1.5)
  const times = Math.round(windowTime / interval / 2)
  const speedAnalyzer = new SpeedAnalyzer({
    windowTime,
    maxGapBetweenTimeSlots,
  })
  const speed = 1000

  await run(
    speedAnalyzer,
    times,
    () => speed,
    interval,
  )

  t.false(speedAnalyzer.hasEnoughSamples())
  t.is(speedAnalyzer.getAverageDownloadSpeed(), NaN)
})

test('too wide gap', async t => {
  const windowTime = 2000
  const interval = 50
  const maxGapBetweenTimeSlots = Math.round(interval * 0.75)
  const times = Math.round(windowTime / interval) + 1
  const speedAnalyzer = new SpeedAnalyzer({
    windowTime,
    maxGapBetweenTimeSlots,
  })
  const speed = 1000

  await run(
    speedAnalyzer,
    times,
    () => speed,
    interval,
  )

  t.false(speedAnalyzer.hasEnoughSamples())
  t.is(speedAnalyzer.getAverageDownloadSpeed(), NaN)
})
