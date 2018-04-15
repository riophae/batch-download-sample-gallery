const path = require('path')
const u = require('url')
const axios = require('axios')
const filenamify = require('../lib/filenamify')

function getGallery(galleryId) {
  const endpoint = 'https://www.dpreview.com/sample-galleries/data/get-gallery'
  const params = { galleryId, isMobile: false }
  return axios.get(endpoint, { params })
}

function extNameFromUrl(url) {
  return path.extname(u.parse(url).pathname)
}

module.exports = async url => {
  const galleryId = url.match(/dpreview\.com\/sample-galleries\/(\d+)\//)[1]
  const { data } = await getGallery(galleryId)
  const title = data.gallery.title + ' (dpreview)'
  const items = data.images.reduce((prev, item) => {
    if (item.url) prev.push({ name: filenamify(`${item.id}.jpg`), url: item.url })
    if (item.rawUrl) prev.push({ name: filenamify(`${item.id}${extNameFromUrl(item.rawUrl)}`), url: item.rawUrl })
    return prev
  }, [])
  return { title, items }
}
