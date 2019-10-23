'use strict'

const cheerio = require('cheerio')
const GlobalState = require('../utils/global-state')
const request = require('../utils/request')

module.exports = async () => {
  const inputGalleryUrl = GlobalState.get('inputGalleryUrl')
  const html = await request({ url: inputGalleryUrl })
  const $ = cheerio.load(html)
  const title = $('.sample_header_text h2').text().trim()
  const links = $('.sample_pic_nav > a[href^="viewsamples.php?picture="]').toArray()

  GlobalState.set('galleryData.title', title + ' (dcfever)')
  GlobalState.set('galleryData.items', links.map(link => ({
    name: `${link.attribs.href.match(/picture=(\d+)/)[1]}.jpg`,
    url: link.children[0].attribs.src.replace(/_s\.jpg$/, '.jpg'),
  })))
}
