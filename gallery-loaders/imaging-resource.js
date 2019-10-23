'use strict'

const cheerio = require('cheerio')
const dedupe = require('dedupe')
const GlobalState = require('../utils/global-state')
const request = require('../utils/request')

const fileNameRE = /[a-z0-9-_]+\.[a-z0-9]{3}/ig
const testFileNameRE = /^[a-z0-9-_]+\.[a-z0-9]{3}$/i

async function getGallery(url) {
  const html = await request({ url })
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
    fileNames,
  }
}

module.exports = async () => {
  const inputGalleryUrl = GlobalState.get('inputGalleryUrl')
  const productId = inputGalleryUrl.match(/imaging-resource\.com\/PRODS\/([^\\]+)\//)[1]
  const galleryUrl = `https://www.imaging-resource.com/PRODS/${productId}/${productId}GALLERY.HTM`
  const { title, fileNames } = await getGallery(galleryUrl)

  GlobalState.set('galleryData.title', title + ' (imaging-resource)')
  GlobalState.set('galleryData.items', dedupe(fileNames).map(fileName => ({
    name: fileName,
    url: `https://www.imaging-resource.com/PRODS/${productId}/FULLRES/${fileName}`,
  })))
  GlobalState.set('aria2.referer', galleryUrl)
}
