# batch-download-sample-gallery

![screenshot](https://raw.githubusercontent.com/riophae/batch-download-sample-gallery/master/screenshot.png)

A CLI tool for batch downloading sample images from digital camera review websites.

## Supported

- [Digital Photography Review](https://www.dpreview.com/)
- [Imaging Resource](https://www.imaging-resource.com/)
- [Photography Blog](https://www.photographyblog.com/)
- [DCFever](https://www.dcfever.com/)

## Pre-requisites

- [Node.js](https://nodejs.org)
- [aria2](https://aria2.github.io/)

## Usage

```bash
git clone https://github.com/riophae/batch-download-sample-gallery.git
cd batch-download-sample-gallery
npm install --production
node download <Gallery URL>
```

Per default the downloaded image files will be saved in `output/<Gallery Name>/` directory. You can change it in the config file.

**Gallery URL examples:**

- https://www.dpreview.com/sample-galleries/5058069396/panasonic-lumix-gx9-sample-gallery
- https://www.imaging-resource.com/PRODS/panasonic-g9/panasonic-g9GALLERY.HTM
- https://www.photographyblog.com/reviews/leica_cl_review/sample_images/
- https://www.dcfever.com/cameras/viewsamples.php?set=1080

## Configuration

- Make a copy of `config.default.js` and rename it to `config.js`
- Edit it to your likings

## License

MIT © [Riophae Lee](https://github.com/riophae)
