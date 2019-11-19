'use strict'

const Url = require('url')
const assert = require('assert')
const hash = require('object-hash')
const Config = require('../libs/config')
const updateStdout = require('../utils/update-stdout')
const compareDomains = require('../utils/compare-domains')

const adapterIds = [
  'dpreview',
  'imaging-resource',
  'photography-blog',
  'dcfever',
]
const adapters = adapterIds.map(id => {
  const { domain, urlProcessor, galleryLoader } = require(`./${id}`)

  return { id, domain, urlProcessor, galleryLoader }
})

function isWebsiteSupported(galleryUrl) {
  const { host } = Url.parse(galleryUrl)

  return adapters.some(adapter => compareDomains(adapter.domain, host))
}

function isGalleryUrlValid(galleryUrl) {
  return !!findAdapterForUrl(galleryUrl)
}

function findAdapterForUrl(galleryUrl) {
  const { host } = Url.parse(galleryUrl)

  return adapters.find(adapter => (
    compareDomains(adapter.domain, host) &&
    adapter.urlProcessor(galleryUrl)
  ))
}

function extractDataFromUrl(galleryUrl) {
  const adapter = findAdapterForUrl(galleryUrl)

  return {
    type: adapter.id,
    data: adapter.urlProcessor(galleryUrl),
  }
}

function createHashForUrl(galleryUrl) {
  return hash(extractDataFromUrl(galleryUrl))
}

async function loadGallery(galleryUrl) {
  updateStdout('Fetching gallery data...')

  const adapter = findAdapterForUrl(galleryUrl)
  const galleryData = await adapter.galleryLoader(galleryUrl)

  assert(typeof galleryData.title === 'string' && galleryData.title.length)
  assert(Array.isArray(galleryData.images) && galleryData.images.length)
  if ('videos' in galleryData) {
    assert(Array.isArray(galleryData.videos))
  } else {
    galleryData.videos = []
  }
  assert(typeof galleryData.actualGalleryUrl === 'string' && galleryData.actualGalleryUrl.length)

  galleryData.title += ` (${adapter.id})`
  galleryData.items = Config.read('downloadSampleMovies')
    ? [ ...galleryData.images, ...galleryData.videos ]
    : [ ...galleryData.images ]

  delete galleryData.images
  delete galleryData.videos

  return galleryData
}

module.exports = {
  isWebsiteSupported,
  isGalleryUrlValid,
  createHashForUrl,
  loadGallery,
}
