const request = require('request-promise-native')
const cheerio = require('cheerio')

async function getGallery(galleryUrl) {
  const html = await request.get(galleryUrl)
  const $ = cheerio.load(html)
  const title = $('.sample_header_text h2').text().trim() + ' (dcfever)'
  const links = $('.sample_pic_nav > a[href^="viewsamples.php?picture="]').toArray()
  const items = links.map(link => {
    const id = link.attribs.href.match(/picture=(\d+)/)[1]
    const url = link.children[0].attribs.src.replace(/_s\.jpg$/, '.jpg')
    return { name: `${id}.jpg`, url }
  })
  return { title, items }
}

module.exports = async galleryUrl => {
  const { title, items } = await getGallery(galleryUrl)
  return { galleryUrl, title, items }
}
