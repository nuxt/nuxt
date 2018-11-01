import consola from 'consola'
import { interactiveEdgeInstall } from './utils'

let askedForInstall = false

async function nuxtImport(module, useEdge) {
  if (useEdge) {
    const edgeModule = `${module}-edge`
    try {
      const modulePath = require.resolve(edgeModule)
      if (modulePath) {
        return import(edgeModule)
      }
    } catch (err) {}

    if (!askedForInstall) {
      askedForInstall = true

      await interactiveEdgeInstall()

      return nuxtImport(module, useEdge)
    }

    consola.warn(`${edgeModule} not found, please install manually\n` +
      `falling back to ${module}`)
  }

  return import(module)
}

export const builder = useEdge => nuxtImport('@nuxt/builder', useEdge)
export const webpack = useEdge => nuxtImport('@nuxt/webpack', useEdge)
export const generator = useEdge => nuxtImport('@nuxt/generator', useEdge)
export const core = useEdge => nuxtImport('@nuxt/core', useEdge)
