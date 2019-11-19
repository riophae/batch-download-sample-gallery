'use strict'

const Url = require('url')
const cheerio = require('cheerio')
const dedupe = require('dedupe')
const request = require('../utils/request')
const joinUrl = require('../utils/join-url')

const domain = 'imaging-resource.com'

const fileNameRE = /^[a-z0-9-_]+\.[a-z0-9]{3}$/i

function urlProcessor(galleryUrl) {
  const { pathname } = Url.parse(galleryUrl)
  const splitPathname = pathname.split('/')

  if (splitPathname.length > 3 && splitPathname[1] === 'PRODS') {
    return {
      type: 'camera',
      cameraModel: splitPathname[2],
    }
  }

  if (splitPathname.length > 3 && splitPathname[1] === 'lenses') {
    return {
      type: 'lens',
      lensModel: splitPathname.slice(2, 4).join('/'),
    }
  }
}

async function galleryLoader(galleryUrl) {
  const { type, cameraModel, lensModel } = urlProcessor(galleryUrl)
  let actualGalleryUrl

  if (type === 'camera') {
    actualGalleryUrl = `https://www.imaging-resource.com/PRODS/${cameraModel}/${cameraModel}GALLERY.HTM`
  } else if (type === 'lens') {
    actualGalleryUrl = `https://www.imaging-resource.com/lenses/${lensModel}/gallery-images/`
  }

  const html = await request({ url: actualGalleryUrl })
  const $ = cheerio.load(html)

  $('#thumbs-table').remove('load').remove('noscript')

  const title = $('h1#bc_r_camname_large').text().trim()
  const items = $('#thumbs-table a').toArray()
    .filter(link => {
      const child = link.children[0]

      return (
        link.children.length === 1 &&
        child.type === 'text' &&
        fileNameRE.test(child.data)
      )
    })
    .map(link => {
      const child = link.children[0]
      const name = child.data
      const url = joinUrl(
        actualGalleryUrl,
        link.attribs.href,
        'FULLRES/',
        name,
      )

      return { name, url }
    })

  return {
    title,
    images: dedupe(items, item => item.url),
    actualGalleryUrl,
  }
}

module.exports = {
  domain,
  urlProcessor,
  galleryLoader,
}
