const path = require('path')
const u = require('url')
const request = require('request-promise-native')

function getGallery(galleryId) {
  return request.get({
    uri: 'https://www.dpreview.com/sample-galleries/data/get-gallery',
    qs: { galleryId, isMobile: false },
    json: true,
  })
}

function extNameFromUrl(url) {
  return path.extname(u.parse(url).pathname)
}

module.exports = async galleryUrl => {
  const galleryId = galleryUrl.match(/dpreview\.com\/sample-galleries\/(\d+)\//)[1]
  const data = await getGallery(galleryId)
  const title = data.gallery.title + ' (dpreview)'
  const items = data.images.reduce((prev, item) => {
    if (item.url) prev.push({ name: `${item.id}.jpg`, url: item.url })
    if (item.rawUrl) prev.push({ name: `${item.id}${extNameFromUrl(item.rawUrl)}`, url: item.rawUrl })
    return prev
  }, [])
  return { galleryUrl, title, items }
}
