const execa = require('execa')
const Aria2 = require('aria2')
const sleep = require('yaku/lib/sleep')
const getPort = require('get-port')
const readConfig = require('./read-config')

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
  ])
  await sleep(500)

  const aria2 = new Aria2({
    host: 'localhost',
    port,
  })

  await aria2.open()

  return [ aria2, port ]
}
