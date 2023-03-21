const util = require('node:util')
const { compileTemplate, compileScript, parse } = require('@vue/compiler-sfc')
const qs = require('qs')
// const type { LoaderContext } = require('@rspack/core')

const descCache = new Map()

module.exports = function vueLoader (content) {
  const query = qs.parse(this.resourceQuery, { ignoreQueryPrefix: true })

  const callback = this.async()
  const inner = async () => {
    if (query.vue === 'true') {
      const cache = descCache.get(this.resourcePath)
      const { script, styles, template } = cache
      if (query.type === 'script') {
        return script.content
      } else if (query.type === 'style') {
        const lang = styles[0]?.lang
        return styles[0]?.content || 'export default {}'
      } else if (query.type === 'template') {
        if (!template) {
          return ''
        } else {
          const result = compileTemplate({
            source: template.content,
            id: '1234'
          })
          return result.code
        }
      }
    } else {
      const parsed = parse(content, {
        sourceMap: false,
        filename: this.resourcePath
      })
      const descriptor = parsed.descriptor
      const { script, scriptSetup, styles, template, customBlocks } = descriptor
      descCache.set(this.resource, {
        ...parsed.descriptor,
        script: compileScript(descriptor, {
          id: Math.random().toString(),
          isProd: false
        })
      })
      const jsPath = this.resourcePath + '?vue=true&type=script'
      // const jscode = await util.promisify(this.loadModule)(jsPath);
      const cssPath = this.resourcePath + '?vue=true&type=style'
      const templatePath = this.resourcePath + '?vue=true&type=template'
      // const csscode = await util.promisify(this.loadModule)(cssPath);
      // console.log('csscode:', csscode);
      return `import obj from ${JSON.stringify(jsPath)};
      require(${
          JSON.stringify(cssPath)});const { render } = require(${
          JSON.stringify(templatePath)});export default { ...obj, render}`
    }
  }
  return util.callbackify(inner)((err, data) => {
    callback(err, data)
  })
}
