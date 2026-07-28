import type { HmrContext, Plugin } from 'vite'

// Used by the SSR virtual-module HMR regression test (#30169).
// `load()` returns a monotonically incrementing counter, and
// `handleHotUpdate` invalidates the virtual module so the SSR runner has
// to re-evaluate it on the next render.
export function virtualCounterPlugin (): Plugin {
  const virtualId = 'virtual:hmr-counter'
  const resolvedVirtualId = '\0' + virtualId
  let counter = 0

  return {
    name: 'test:virtual-counter',
    resolveId (id) {
      if (id === virtualId) {
        return resolvedVirtualId
      }
    },
    load (id) {
      if (id === resolvedVirtualId) {
        counter += 1
        return `export const counter = ${counter}`
      }
    },
    async handleHotUpdate (ctx: HmrContext) {
      const { server, timestamp } = ctx
      const mod = server.moduleGraph.getModuleById(resolvedVirtualId)
      if (!mod) { return }
      server.moduleGraph.invalidateModule(mod, undefined, timestamp)
      await server.reloadModule(mod)
    },
  }
}
