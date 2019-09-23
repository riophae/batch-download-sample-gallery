'use strict'

const cheerio = require('cheerio')
const dedupe = require('dedupe')
const request = require('../utils/request')
const getFilenameFromUrl = require('../utils/get-filename-from-url')
const { readConfig } = require('../utils/config')
const { getGlobalState, setGlobalState } = require('../utils/global-state')

module.exports = async () => {
  const inputGalleryUrl = getGlobalState('inputGalleryUrl')
  const html = await request({ url: inputGalleryUrl })
  const $ = cheerio.load(html)

  const title = $('.entry-title-wide h1.item').text().replace(/\bReview\b/, '').trim()
  const images = $('table .exif a').toArray()
    .filter(el => $(el).text().trim() === 'Download Original')
  const videos = readConfig('downloadSampleMovies')
    ? $('p.movie-link a').toArray()
    : []
  const mediaUrls = [ ...images, ...videos ].map(el => $(el).prop('href'))

  setGlobalState('galleryData.title', title + ' (photography-blog)')
  setGlobalState('galleryData.items', dedupe(mediaUrls).map(url => ({
    name: getFilenameFromUrl(url),
    url,
  })))
}
