'use strict'

const cheerio = require('cheerio')
const request = require('../utils/request')
const { getGlobalState, setGlobalState } = require('../utils/global-state')

module.exports = async () => {
  const inputGalleryUrl = getGlobalState('inputGalleryUrl')
  const html = await request({ url: inputGalleryUrl })
  const $ = cheerio.load(html)
  const title = $('.sample_header_text h2').text().trim()
  const links = $('.sample_pic_nav > a[href^="viewsamples.php?picture="]').toArray()

  setGlobalState('galleryData.title', title + ' (dcfever)')
  setGlobalState('galleryData.items', links.map(link => ({
    name: `${link.attribs.href.match(/picture=(\d+)/)[1]}.jpg`,
    url: link.children[0].attribs.src.replace(/_s\.jpg$/, '.jpg'),
  })))
}
