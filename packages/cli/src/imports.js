import consola from 'consola'

function nuxtImport(module, useEdge) {
  if (useEdge) {
    const edgeModule = `${module}-edge`
    try {
      const modulePath = require.resolve(edgeModule)
      if (modulePath) {
        return import(edgeModule)
      }
    } catch (err) {}

    consola.warn(`${edgeModule} not found, please install manually\n` +
      `falling back to ${module}`)
  }

  return import(module)
}

export const builder = useEdge => nuxtImport('@nuxt/builder', useEdge)
export const webpack = useEdge => nuxtImport('@nuxt/webpack', useEdge)
export const generator = useEdge => nuxtImport('@nuxt/generator', useEdge)
export const core = useEdge => nuxtImport('@nuxt/core', useEdge)
