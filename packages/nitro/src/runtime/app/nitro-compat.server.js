export default ({ ssrContext }) => {
  ssrContext.renderMeta = () => {
    const meta = ssrContext.meta.inject({
      isSSR: ssrContext.nuxt.serverRendered,
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
}
