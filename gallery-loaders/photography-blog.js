'use strict'

const cheerio = require('cheerio')
const dedupe = require('dedupe')
const request = require('../utils/request')
const getFilenameFromUrl = require('../utils/get-filename-from-url')
const { getGlobalState, setGlobalState } = require('../utils/global-state')

async function getGallery(url) {
  const html = await request({ url })
  const $ = cheerio.load(html)
  const title = $('.entry-title-wide h1.item').text().replace(/\bReview\b/, '').trim()
  const images = $('table .exif a').toArray()
    .filter(el => $(el).text().trim() === 'Download Original')
  const videos = getGlobalState('config.downloadSampleMovies')
    ? $('p.movie-link a').toArray()
    : []
  const items = [ ...images, ...videos ].map(el => $(el).prop('href'))

  return {
    title,
    items: dedupe(items),
  }
}

module.exports = async () => {
  const inputGalleryUrl = getGlobalState('inputGalleryUrl')
  const data = await getGallery(inputGalleryUrl)
  const title = data.title + ' (photography-blog)'
  const items = data.items.map(url => ({
    name: getFilenameFromUrl(url),
    url,
  }))

  return {
    galleryUrl: inputGalleryUrl,
    title,
    items,
  }
}
