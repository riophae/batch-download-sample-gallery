'use strict'

const Url = require('url')
const cheerio = require('cheerio')
const dedupe = require('dedupe')
const request = require('../utils/request')
const isPageExisting = require('../utils/is-page-existing')
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
    actualGalleryUrl = `https://www.photographyblog.com/reviews/${reviewId}/sample_images`

    if (!await isPageExisting(actualGalleryUrl)) {
      actualGalleryUrl = `https://www.photographyblog.com/reviews/${reviewId}/preview_images`

      if (!await isPageExisting(actualGalleryUrl)) {
        // TODO
        actualGalleryUrl = null
      }
    }
  } else if (type === 'preview') {
    actualGalleryUrl = galleryUrl
  }

  const html = await request({ url: actualGalleryUrl })
  const $ = cheerio.load(html)

  const title = $('.entry-title-wide h1.item')
    .text()
    .replace(/\bReview\b/, '')
    .trim()
  const imageLinks = $('table .exif a')
    .toArray()
    .filter(el => $(el).text().trim() === 'Download Original')
  const videoLinks = $('p.movie-link a')
    .toArray()
  const linksToItems = links => dedupe(links.map(el => $(el).prop('href')))
    .map(url => ({
      name: getFilenameFromUrl(url),
      url,
    }))

  return {
    title,
    images: linksToItems(imageLinks),
    videos: linksToItems(videoLinks),
    actualGalleryUrl,
  }
}

module.exports = {
  domain,
  urlProcessor,
  galleryLoader,
}
