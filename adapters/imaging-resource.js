'use strict'

const cheerio = require('cheerio')
const dedupe = require('dedupe')
const request = require('../utils/request')
const joinUrl = require('../utils/join-url')

const domain = 'imaging-resource.com'

const fileNameRE = /^[\w-]+\.[\da-z]{3}$/i

function urlProcessor(galleryUrl) {
  const { pathname } = new URL(galleryUrl)
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
  const items = []

  $('#thumbs-table td').toArray().forEach(td => {
    const childNodes = Array.from($(td).contents())

    childNodes.forEach(childNode => {
      if (childNode.type === 'text') {
        const text = childNode.data.trim()
        const matched = text.match(fileNameRE)

        if (matched) {
          const name = matched[0]
          const url = joinUrl(
            actualGalleryUrl,
            'FULLRES/',
            name,
          )

          items.push({ name, url })
        }
      } else if (childNode.type === 'tag' && childNode.name === 'a') {
        const grandchildNode = childNode.children[0]

        if (
          childNode.children.length === 1 &&
          grandchildNode.type === 'text' &&
          fileNameRE.test(grandchildNode.data.trim())
        ) {
          const name = grandchildNode.data.trim()
          const url = joinUrl(
            actualGalleryUrl,
            childNode.attribs.href,
            'FULLRES/',
            name,
          )

          items.push({ name, url })
        }
      }
    })
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
