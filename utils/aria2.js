'use strict'

const execa = require('execa')
const Aria2 = require('aria2')
const getPort = require('get-port')
const portUsed = require('port-used')
const compact = require('@extra-array/compact')
const { getGlobalState, setGlobalState } = require('./global-state')
const untilProcessExits = require('./until-process-exits')

const CHECK_PORT_RETRY_INTERVAL = 50
const CHECK_PORT_TIMEOUT = 5000

let aria2server
let aria2client

async function startAria2() {
  const config = getGlobalState('config')
  const port = config.aria2.port || await getPort()

  aria2server = execa('aria2c', compact([
    '--enable-rpc',
    '--rpc-allow-origin-all',
    `--rpc-listen-port=${port}`,
    `--max-concurrent-downloads=${config.aria2.concurrent}`,
    `--split=${config.aria2.split}`,
    '--conditional-get',
    '--remote-time',
    // getGlobalState('aria2.session.isExists')
    //   ? `--input-file=${getGlobalState('aria2.session.path')}`
    //   : null,
    `--save-session=${getGlobalState('aria2.session.path')}`,
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

  setGlobalState('aria2.instance', aria2client)
  setGlobalState('aria2.port', port)
}

async function stopAria2() {
  await aria2client.close()
  // eslint-disable-next-line require-atomic-updates
  aria2client = null
  setGlobalState('aria2.instance', null)
  setGlobalState('aria2.port', -1)

  aria2server.cancel()
  await untilProcessExits(aria2server.pid)
  // eslint-disable-next-line require-atomic-updates
  aria2server = null
}

module.exports = {
  startAria2,
  stopAria2,
}
