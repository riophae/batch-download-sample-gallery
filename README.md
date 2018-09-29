# batch-download-sample-gallery

![screenshot](https://raw.githubusercontent.com/riophae/batch-download-sample-gallery/master/screenshot.png)

Batch download sample images from digital camera review websites.

## Supported

- [Digital Photography Review](https://www.dpreview.com/)
- [Imaging Resource](https://www.imaging-resource.com/)
- [Photography Blog](https://www.photographyblog.com/)

## Pre-requisites

- [Node.js](https://nodejs.org)
- [aria2](https://aria2.github.io/)

## Usage

```bash
git clone https://github.com/riophae/batch-download-sample-gallery.git
cd batch-download-sample-gallery
npm install
node download <gallery_url>
# the downloaded image files will be stored at output/<gallery_name>/ directory
```

**Gallery URL examples:**

- https://www.dpreview.com/sample-galleries/5058069396/panasonic-lumix-gx9-sample-gallery
- https://www.imaging-resource.com/PRODS/panasonic-g9/panasonic-g9GALLERY.HTM
- https://www.photographyblog.com/reviews/leica_cl_review/sample_images/

## Configuration

- Copy `config.default.js` and rename it to `config.js`
- Edit to your preference

## License

MIT © [Riophae Lee](https://github.com/riophae)
