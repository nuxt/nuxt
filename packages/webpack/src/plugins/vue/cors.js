import HTMLPlugin from 'html-webpack-plugin'
import { className } from 'postcss-selector-parser';

export default class CorsPlugin {
  constructor({ crossorigin }) {
    this.crossorigin = crossorigin
  }

  apply(compiler) {
    const ID = `vue-cors-plugin`
    compiler.hooks.compilation.tap(ID, (compilation) => {
      HTMLPlugin.getHooks(compilation).alterAssetTagGroups.tap(ID, (data, cb) => {
        if (this.crossorigin != null) {
          [...data.headTags, ...data.bodyTags].forEach((tag) => {
            if (tag.tagName === 'script' || tag.tagName === 'link') {
              if (tag.attributes) {
                tag.attributes.crossorigin = this.crossorigin
              }
            }
          })
        }
        cb(null, data)
      })
    })
  }
}
