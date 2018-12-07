export default class CorsPlugin {
  constructor({ crossorigin }) {
    this.crossorigin = crossorigin
  }

  apply(compiler) {
    const ID = `vue-cors-plugin`
    compiler.hooks.compilation.tap(ID, (compilation) => {
      compilation.hooks.htmlWebpackPluginAlterAssetTags.tap(ID, (data) => {
        if (this.crossorigin != null) {
          [...data.head, ...data.body].forEach((tag) => {
            if (tag.tagName === 'script' || tag.tagName === 'link') {
              if (tag.attributes) {
                tag.attributes.crossorigin = this.crossorigin
              }
            }
          })
        }
      })
    })
  }
}
