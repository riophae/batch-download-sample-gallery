const fs = require('fs')
const path = require('path')
const update = require('log-update')
const download = require('download')
// const sleep = require('yaku/lib/sleep')
const makeDir = require('make-dir')
const filenamify = require('./lib/filenamify')

function getGalleryLoader(url) {
  if (!url) throw new Error('No url provided')
  if (url.includes('dpreview.com')) return require('./gallery-loaders/dpreview')
  throw new Error('Unknown')
}

async function main() {
  const url = process.argv[2]
  const galleryLoader = getGalleryLoader(url)
  update('Fetching gallery data...')
  const { title, items } = await galleryLoader(url)
  const outputDir = path.join(__dirname, 'output', filenamify(title))
  await makeDir(outputDir)
  for (let i = 0; i < items.length; i++) {
    const curr = items[i]
    update([
      `Title: ${title}`,
      `Current (${i + 1}/${items.length}): ${curr.name}`,
    ].join('\n'))
    const task = download(curr.url)
    task.pipe(fs.createWriteStream(path.join(outputDir, curr.name)))
    await task
  }
}

main()
