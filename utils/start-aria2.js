const execa = require('execa')
const Aria2 = require('aria2')
const getPort = require('get-port')
const portUsed = require('port-used')
const readConfig = require('./read-config')

const CHECK_PORT_RETRY_INTERVAL = 50
const CHECK_PORT_TIMEOUT = 5000

module.exports = async function startAria2() {
  const config = readConfig()
  const port = config.aria2.port || await getPort()

  execa('aria2c', [
    '--enable-rpc',
    '--rpc-allow-origin-all',
    `--rpc-listen-port=${port}`,
    `--max-concurrent-downloads=${config.aria2.concurrent}`,
    `--split=${config.aria2.split}`,
    '--conditional-get',
    '--remote-time',
  ]).catch(error => {
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

  return [ aria2, port ]
}
