'use strict'

const Url = require('url')
const cheerio = require('cheerio')
const request = require('../utils/request')

const domain = 'dcfever.com'

function urlProcessor(galleryUrl) {
  const { pathname, query } = Url.parse(galleryUrl, true)
  const splitPathname = pathname.split('/')

  if (
    [ 'cameras', 'lens' ].includes(splitPathname[1]) &&
    splitPathname[2] === 'viewsamples.php' &&
    /^\d+$/.test(query.set)
  ) return {
    type: splitPathname[1],
    setId: query.set,
  }
}

async function galleryLoader(galleryUrl) {
  const html = await request({ url: galleryUrl })
  const $ = cheerio.load(html)

  const title = $('.sample_header_text h2').text().trim()
  const links = $('.sample_pic_nav > a[href^="viewsamples.php?picture="]').toArray()

  return {
    title,
    items: links.map(link => ({
      name: `${link.attribs.href.match(/picture=(\d+)/)[1]}.jpg`,
      url: link.children[0].attribs.src.replace(/_s\.jpg$/, '.jpg'),
    })),
    actualGalleryUrl: galleryUrl,
  }
}

module.exports = {
  domain,
  urlProcessor,
  galleryLoader,
}
