'use strict'

const execa = require('execa')
const Aria2 = require('aria2')
const getPort = require('just-once')(require('get-port'))
const portUsed = require('port-used')
const compact = require('@extra-array/compact')
const Config = require('./config')
const GlobalState = require('./global-state')
const untilProcessExits = require('./until-process-exits')

const CHECK_PORT_RETRY_INTERVAL = 50
const CHECK_PORT_TIMEOUT = 5000

let aria2server
let aria2client

async function startAria2() {
  const port = Config.read('aria2.port') || await getPort()
  const diskCache = Config.read('aria2.diskCache')

  aria2server = execa('aria2c', compact([
    '--enable-rpc',
    '--rpc-allow-origin-all',
    `--rpc-listen-port=${port}`,
    `--max-concurrent-downloads=${Config.read('aria2.concurrent')}`,
    `--split=${Config.read('aria2.split')}`,
    `--max-download-limit=${Config.read('aria2.speedLimit')}`,
    `--max-overall-download-limit=${Config.read('aria2.overallSpeedLimit')}`,
    diskCache
      ? `--disk-cache=${diskCache}`
      : null,
    '--conditional-get',
    '--remote-time',
    GlobalState.get('aria2.session.isExists')
      ? `--input-file=${GlobalState.get('aria2.session.filePath')}`
      : null,
    `--save-session=${GlobalState.get('aria2.session.filePath')}`,
  ]))
  aria2server.catch(error => {
    console.error(error)
    process.exit(1)
  })
  await portUsed.waitUntilUsed(
    port,
    CHECK_PORT_RETRY_INTERVAL,
    CHECK_PORT_TIMEOUT,
  )

  aria2client = new Aria2({
    host: 'localhost',
    port,
  })
  await aria2client.open()

  GlobalState.set('aria2.instance', aria2client)
}

async function stopAria2() {
  await aria2client.close()
  aria2client = null
  GlobalState.set('aria2.instance', null)

  aria2server.cancel()
  await untilProcessExits(aria2server.pid)
  aria2server = null
}

module.exports = {
  startAria2,
  stopAria2,
}
