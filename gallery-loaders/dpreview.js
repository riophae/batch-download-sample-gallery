'use strict'

const path = require('path')
const request = require('../utils/request')
const getFilenameFromUrl = require('../utils/get-filename-from-url')
const { getGlobalState, setGlobalState } = require('../utils/global-state')

module.exports = async () => {
  const inputGalleryUrl = getGlobalState('inputGalleryUrl')
  const galleryId = inputGalleryUrl.match(/dpreview\.com\/sample-galleries\/(\d+)\//)[1]
  const data = await request({
    url: 'https://www.dpreview.com/sample-galleries/data/get-gallery',
    qs: { galleryId, isMobile: false },
    json: true,
  })

  setGlobalState('galleryData.title', data.gallery.title + ' (dpreview)')
  setGlobalState('galleryData.items', data.images.reduce((prev, item) => {
    if (item.url) prev.push({
      name: `${item.id}.jpg`,
      url: item.url,
    })

    if (item.rawUrl) prev.push({
      name: `${item.id}${path.extname(getFilenameFromUrl(item.rawUrl))}`,
      url: item.rawUrl,
    })

    return prev
  }, []))
}
