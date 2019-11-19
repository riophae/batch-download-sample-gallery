'use strict'

const execa = require('execa')
const Aria2Client = require('aria2')
const getPort = require('just-once')(require('get-port'))
const portUsed = require('port-used')
const compact = require('@extra-array/compact')
const untilProcessExits = require('../utils/until-process-exits')
const Config = require('./config')
const GlobalState = require('./global-state')

let aria2server
let aria2client

const Aria2 = {
  async start() {
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
      GlobalState.get('aria2.sessionFile.isExisting')
        ? `--input-file=${GlobalState.get('aria2.sessionFile.path')}`
        : null,
      `--save-session=${GlobalState.get('aria2.sessionFile.path')}`,
    ]))
    aria2server.catch(error => {
      console.error(error)
      process.exit(1)
    })
    await portUsed.waitUntilUsed(port)

    aria2client = new Aria2Client({
      host: 'localhost',
      port,
    })
    await aria2client.open()
  },

  async stop() {
    await aria2client.close()
    aria2client = null

    aria2server.cancel()
    await untilProcessExits(aria2server.pid)
    aria2server = null
  },

  getClient() {
    return aria2client
  },
}

module.exports = Aria2
