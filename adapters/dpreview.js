'use strict'

const path = require('path')
const Url = require('url')
const request = require('../utils/request')
const getFilenameFromUrl = require('../utils/get-filename-from-url')

const domain = 'dpreview.com'

function urlProcessor(galleryUrl) {
  const { pathname } = Url.parse(galleryUrl)
  const splitPathname = pathname.split('/')

  if (
    splitPathname.length > 1 &&
    splitPathname[1] === 'sample-galleries' &&
    /^\d+$/.test(splitPathname[2])
  ) return {
    galleryId: splitPathname[2],
  }
}

async function galleryLoader(galleryUrl) {
  const { galleryId } = urlProcessor(galleryUrl)
  const data = await request({
    url: 'https://www.dpreview.com/sample-galleries/data/get-gallery',
    qs: { galleryId, isMobile: false },
    json: true,
  })

  return {
    title: data.gallery.title,
    items: data.images.reduce((prev, item) => {
      if (item.url) prev.push({
        name: `${item.id}.jpg`,
        url: item.url,
      })

      if (item.rawUrl) prev.push({
        name: `${item.id}${path.extname(getFilenameFromUrl(item.rawUrl))}`,
        url: item.rawUrl,
      })

      return prev
    }, []),
    actualGalleryUrl: galleryUrl,
  }
}

module.exports = {
  domain,
  urlProcessor,
  galleryLoader,
}
