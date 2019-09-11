'use strict'

const cheerio = require('cheerio')
const request = require('../utils/request')

async function getGallery(url) {
  const html = await request({ url })
  const $ = cheerio.load(html)
  const title = $('.sample_header_text h2').text().trim() + ' (dcfever)'
  const links = $('.sample_pic_nav > a[href^="viewsamples.php?picture="]').toArray()
  const items = links.map(link => ({
    name: `${link.attribs.href.match(/picture=(\d+)/)[1]}.jpg`,
    url: link.children[0].attribs.src.replace(/_s\.jpg$/, '.jpg'),
  }))
  return { title, items }
}

module.exports = async galleryUrl => {
  const { title, items } = await getGallery(galleryUrl)
  return { galleryUrl, title, items }
}
