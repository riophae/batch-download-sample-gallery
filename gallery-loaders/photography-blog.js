const u = require('url')
const request = require('request-promise-native')
const cheerio = require('cheerio')
const dedupe = require('dedupe')

async function getGallery(uri) {
  const html = await request.get(uri)
  const $ = cheerio.load(html)
  const title = $('.entry-title-wide h1.item').text().replace(/\bReview\b/, '').trim()
  const images = $('table .exif a').toArray()
    .filter(el => $(el).text().trim() === 'Download Original')
  const videos = $('p.movie-link a').toArray()
  const items = [ ...images, ...videos ].map(el => $(el).prop('href'))
  return { title, items: dedupe(items) }
}

function getFileNameFromUrl(url) {
  const { pathname } = u.parse(url)
  return pathname.split('/').reverse()[0]
}

module.exports = async galleryUrl => {
  const data = await getGallery(galleryUrl)
  const title = data.title + ' (photography-blog)'
  const items = data.items.map(url => ({
    name: getFileNameFromUrl(url),
    url,
  }))
  return { galleryUrl, title, items }
}