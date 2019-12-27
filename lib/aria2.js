'use strict'

const execa = require('execa')
const Aria2Client = require('aria2')
const RotatingFileStream = require('rotating-file-stream')
const tinydate = require('tinydate')
const getPort = require('just-once')(require('get-port'))
const portUsed = require('port-used')
const pDefer = require('p-defer')
const pTimeout = require('p-timeout')
const padStart = require('lodash/padStart')
const compact = require('@extra-array/compact')
const untilProcessExits = require('../utils/until-process-exits')
const Config = require('./config')
const GlobalState = require('./global-state')

let aria2server
let aria2client

let logFileStream

const Aria2 = {
  _initLogging() {
    const formatDate = tinydate('{YYYY}{MM}{DD}')
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const fileNameGenerator = (time, index = 0) => [
      formatDate(time),
      'aria2c',
      padStart(index, 3, '0') + '.log',
    ].join('-')
    const options = {
      interval: '1d',
      size: '10M',
      maxSize: '200M',
      path: Config.read('aria2.logOutputDir'),
    }

    logFileStream = RotatingFileStream.createStream(fileNameGenerator, options)
  },

  async start() {
    const port = Config.read('aria2.port') || await getPort()
    const diskCache = Config.read('aria2.diskCache')

    aria2server = execa('aria2c', compact([
      '--enable-rpc',
      '--rpc-allow-origin-all',
      `--rpc-listen-port=${port}`,
      '--enable-color=false',
      '--show-console-readout=false',
      '--summary-interval=0',
      `--log-level=${Config.read('aria2.logLevel')}`,
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
    ]), {
      all: true,
    })
    aria2server.catch(error => {
      console.error(error)
    })

    if (Config.read('aria2.enableLogging')) {
      Aria2._initLogging()
      aria2server.all.pipe(logFileStream)
    }

    await portUsed.waitUntilUsed(port)

    aria2client = new Aria2Client({
      host: 'localhost',
      port,
    })
    await aria2client.open()
  },

  async reconnect(gid) {
    const d = pDefer()

    aria2client.on('onDownloadPause', function listener([ event ]) {
      if (event.gid === gid) {
        d.resolve()
        aria2client.off('onDownloadPause', listener)
      }
    })

    await aria2client.call('pause', gid)
    // Wait for the 'pause' operation to be completed.
    await pTimeout(d.promise, 5000)
    await aria2client.call('unpause', gid)
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
