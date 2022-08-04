import { ViteNodeRunner } from 'vite-node/client'
import { $fetch } from 'ohmyfetch'
import { getViteNodeOptions } from './vite-node-shared.mjs'

const viteNodeOptions = getViteNodeOptions()

const runner = new ViteNodeRunner({
  root: viteNodeOptions.rootDir,
  base: viteNodeOptions.base,
  async fetchModule (id) {
    return await $fetch('/module/' + encodeURI(id), {
      baseURL: viteNodeOptions.baseURL
    })
  }
})

let render

export default async (ssrContext) => {
  // Workaround for stub mode
  // https://github.com/nuxt/framework/pull/3983
  process.server = true

  // Invalidate cache for files changed since last rendering
  const invalidates = await $fetch('/invalidates', {
    baseURL: viteNodeOptions.baseURL
  })
  for (const key of invalidates) {
    runner.moduleCache.delete(key)
  }

  // Execute SSR bundle on demand
  render = render || (await runner.executeFile(viteNodeOptions.entryPath)).default
  const result = await render(ssrContext)
  return result
}
