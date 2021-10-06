const vueMetaRenderer = (nuxt) => {
  const meta = nuxt.ssrContext.meta.inject({
    isSSR: nuxt.ssrContext.nuxt.serverRendered,
    ln: process.env.NODE_ENV === 'development'
  })

  return {
    htmlAttrs: meta.htmlAttrs.text(),
    headAttrs: meta.headAttrs.text(),
    headTags:
        meta.title.text() + meta.base.text() +
        meta.meta.text() + meta.link.text() +
        meta.style.text() + meta.script.text() +
        meta.noscript.text(),
    bodyAttrs: meta.bodyAttrs.text(),
    bodyScriptsPrepend:
        meta.meta.text({ pbody: true }) + meta.link.text({ pbody: true }) +
        meta.style.text({ pbody: true }) + meta.script.text({ pbody: true }) +
        meta.noscript.text({ pbody: true }),
    bodyScripts:
        meta.meta.text({ body: true }) + meta.link.text({ body: true }) +
        meta.style.text({ body: true }) + meta.script.text({ body: true }) +
        meta.noscript.text({ body: true })
  }
}

export default defineNuxtPlugin((nuxt) => {
  const metaRenderers = [vueMetaRenderer]

  nuxt.callHook('meta:register', metaRenderers)

  nuxt.ssrContext.renderMeta = async () => {
    const metadata = {
      htmlAttrs: '',
      headAttrs: '',
      headTags: '',
      bodyAttrs: '',
      bodyScriptsPrepend: '',
      bodyScripts: ''
    }
    for await (const renderer of metaRenderers) {
      const result = await renderer(nuxt)
      for (const key in result) {
        metadata[key] += result[key]
      }
    }
    return metadata
  }
})
