const request = require('request-promise-native')
const cheerio = require('cheerio')
const dedupe = require('dedupe')

const fileNameRE = /[a-z0-9-_]+\.[a-z0-9]{3}/ig
const testFileNameRe = /^[a-z0-9-_]+\.[a-z0-9]{3}$/i

async function getGallery(uri) {
  const html = await request.get(uri)
  const $ = cheerio.load(html)
  $('#thumbs-table').remove('load').remove('noscript')
  const title = $('h1#bc_r_camname_large .bc_r_camname_mfr').text().trim()
  const links = $('#thumbs-table a').toArray()
  let fileNames = links
    .map(elem => $(elem).text().trim())
    .filter(text => testFileNameRe.test(text))
  if (!fileNames.length) {
    fileNames = $('#thumbs-table').text().match(fileNameRE)
  }
  return { title, fileNames: dedupe(fileNames) }
}

module.exports = async url => {
  const productId = url.match(/imaging-resource\.com\/PRODS\/([^\\]+)\//)[1]
  const galleryUrl = `https://www.imaging-resource.com/PRODS/${productId}/${productId}GALLERY.HTM`
  const data = await getGallery(galleryUrl)
  const title = data.title + ' (imaging-resource)'
  const items = data.fileNames.map(fileName => ({
    name: fileName,
    url: `https://www.imaging-resource.com/PRODS/${productId}/FULLRES/${fileName}`,
  }))
  return { galleryUrl, title, items }
}
