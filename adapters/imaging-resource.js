'use strict'

const Url = require('url')
const cheerio = require('cheerio')
const dedupe = require('dedupe')
const request = require('../utils/request')

const domain = 'imaging-resource.com'

const fileNameRE = /[a-z0-9-_]+\.[a-z0-9]{3}/ig
const testFileNameRE = /^[a-z0-9-_]+\.[a-z0-9]{3}$/i

function urlProcessor(galleryUrl) {
  const { pathname } = Url.parse(galleryUrl)
  const splitPathname = pathname.split('/')

  if (splitPathname.length > 3 && splitPathname[1] === 'PRODS') {
    return {
      productId: splitPathname[2],
    }
  }
}

async function galleryLoader(galleryUrl) {
  const { productId } = urlProcessor(galleryUrl)
  const actualGalleryUrl = `https://www.imaging-resource.com/PRODS/${productId}/${productId}GALLERY.HTM`

  const html = await request({ url: actualGalleryUrl })
  const $ = cheerio.load(html)

  $('#thumbs-table').remove('load').remove('noscript')

  const title = $('h1#bc_r_camname_large .bc_r_camname_mfr').text().trim()
  const links = $('#thumbs-table a').toArray()

  let fileNames = links
    .map(elem => $(elem).text().trim())
    .filter(text => testFileNameRE.test(text))
  if (!fileNames.length) {
    fileNames = $('#thumbs-table').text().match(fileNameRE)
  }

  return {
    title,
    items: dedupe(fileNames).map(fileName => ({
      name: fileName,
      url: `https://www.imaging-resource.com/PRODS/${productId}/FULLRES/${fileName}`,
    })),
    actualGalleryUrl,
  }
}

module.exports = {
  domain,
  urlProcessor,
  galleryLoader,
}
