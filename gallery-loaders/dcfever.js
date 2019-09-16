'use strict'

const cheerio = require('cheerio')
const request = require('../utils/request')
const { getGlobalState, setGlobalState } = require('../utils/global-state')

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

module.exports = async () => {
  const inputGalleryUrl = getGlobalState('inputGalleryUrl')
  const { title, items } = await getGallery(inputGalleryUrl)

  return {
    galleryUrl: inputGalleryUrl,
    title,
    items,
  }
}
