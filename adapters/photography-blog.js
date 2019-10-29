'use strict'

const Url = require('url')
const cheerio = require('cheerio')
const dedupe = require('dedupe')
const Config = require('../libs/config')
const request = require('../utils/request')
const getFilenameFromUrl = require('../utils/get-filename-from-url')

const domain = 'photographyblog.com'

function urlProcessor(galleryUrl) {
  const { pathname } = Url.parse(galleryUrl)
  const splitPathname = pathname.split('/')

  if (
    splitPathname.length > 2 &&
    splitPathname[1] === 'reviews'
  ) return {
    type: 'review',
    reviewId: splitPathname[2],
  }

  if (
    splitPathname.length > 2 &&
    splitPathname[1] === 'previews'
  ) return {
    type: 'preview',
    previewId: splitPathname[2],
  }
}

async function galleryLoader(galleryUrl) {
  const { type, reviewId/*, previewId */ } = urlProcessor(galleryUrl)
  let actualGalleryUrl

  if (type === 'review') {
    actualGalleryUrl = `https://www.photographyblog.com/reviews/${reviewId}/preview_images`
  } else if (type === 'preview') {
    actualGalleryUrl = galleryUrl
  }

  const html = await request({ url: actualGalleryUrl })
  const $ = cheerio.load(html)

  const title = $('.entry-title-wide h1.item')
    .text()
    .replace(/\bReview\b/, '')
    .trim()
  const images = $('table .exif a')
    .toArray()
    .filter(el => $(el).text().trim() === 'Download Original')
  const videos = Config.read('downloadSampleMovies')
    ? $('p.movie-link a').toArray()
    : []
  const mediaUrls = [ ...images, ...videos ]
    .map(el => $(el).prop('href'))

  return {
    title,
    items: dedupe(mediaUrls).map(mediaUrl => ({
      name: getFilenameFromUrl(mediaUrl),
      url: mediaUrl,
    })),
    actualGalleryUrl,
  }
}

module.exports = {
  domain,
  urlProcessor,
  galleryLoader,
}
