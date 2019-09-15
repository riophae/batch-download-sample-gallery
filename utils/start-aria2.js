'use strict'

const execa = require('execa')
const Aria2 = require('aria2')
const getPort = require('get-port')
const portUsed = require('port-used')
const compact = require('@extra-array/compact')
const { getGlobalState, setGlobalState } = require('./global-state')

const CHECK_PORT_RETRY_INTERVAL = 50
const CHECK_PORT_TIMEOUT = 5000

module.exports = async function startAria2() {
  const config = getGlobalState('config')
  const port = config.aria2.port || await getPort()

  execa('aria2c', compact([
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
  ])).catch(error => {
    console.error(error)
    process.exit(1)
  })
  await portUsed.waitUntilUsed(
    port,
    CHECK_PORT_RETRY_INTERVAL,
    CHECK_PORT_TIMEOUT,
  )

  const aria2 = new Aria2({
    host: 'localhost',
    port,
  })
  await aria2.open()

  setGlobalState('aria2.instance', aria2)
  setGlobalState('aria2.port', port)
}
