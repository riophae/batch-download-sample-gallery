'use strict'

const cheerio = require('cheerio')
const dedupe = require('dedupe')
const Config = require('../utils/config')
const GlobalState = require('../utils/global-state')
const request = require('../utils/request')
const getFilenameFromUrl = require('../utils/get-filename-from-url')

module.exports = async () => {
  const inputGalleryUrl = GlobalState.get('inputGalleryUrl')
  const html = await request({ url: inputGalleryUrl })
  const $ = cheerio.load(html)

  const title = $('.entry-title-wide h1.item').text().replace(/\bReview\b/, '').trim()
  const images = $('table .exif a').toArray()
    .filter(el => $(el).text().trim() === 'Download Original')
  const videos = Config.read('downloadSampleMovies')
    ? $('p.movie-link a').toArray()
    : []
  const mediaUrls = [ ...images, ...videos ].map(el => $(el).prop('href'))

  GlobalState.set('galleryData.title', title + ' (photography-blog)')
  GlobalState.set('galleryData.items', dedupe(mediaUrls).map(url => ({
    name: getFilenameFromUrl(url),
    url,
  })))
}
