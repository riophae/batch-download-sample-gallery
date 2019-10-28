'use strict'

const Url = require('url')
const assert = require('assert')
const hash = require('object-hash')
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
  assert(Array.isArray(galleryData.items) && galleryData.items.length)
  assert(typeof galleryData.actualGalleryUrl === 'string' && galleryData.actualGalleryUrl.length)

  galleryData.title += ` (${adapter.id})`

  return galleryData
}

module.exports = {
  isWebsiteSupported,
  createHashForUrl,
  loadGallery,
}