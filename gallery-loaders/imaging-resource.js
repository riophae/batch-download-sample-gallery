const request = require('request-promise-native')
const cheerio = require('cheerio')
const dedupe = require('dedupe')

async function getGallery(uri) {
  const html = await request.get(uri)
  const $ = cheerio.load(html)
  const title = $('h1#bc_r_camname_large .bc_r_camname_mfr').text().trim()
  const fileNames = $('#thumbs-table a').toArray()
    .map(elem => $(elem).text().trim())
    .filter(text => /^[a-z0-9-_]+\.[a-z0-9]{3}$/i.test(text))
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
