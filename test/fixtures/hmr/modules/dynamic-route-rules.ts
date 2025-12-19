import { existsSync, readFileSync, watch } from 'node:fs'
import type { RouteRulesHandle } from 'nuxt/kit'
import { createResolver, defineNuxtModule, extendRouteRules } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'dynamic-route-rules',
  },
  async setup (_, nuxt) {
    const resolver = createResolver(import.meta.url)
    const configPath = resolver.resolve('../dynamic-rules.json')

    let handle: RouteRulesHandle | undefined

    const applyRules = async () => {
      if (!existsSync(configPath)) {
        await handle?.remove()
        handle = undefined
        return
      }
      const content = readFileSync(configPath, 'utf8')
      const rules = JSON.parse(content) as Record<string, any>

      if (handle) {
        await handle.replace(rules)
      } else {
        handle = await extendRouteRules(rules, { override: true })
      }
    }

    // Apply initial rules
    await applyRules()

    // Watch for changes in dev mode
    if (nuxt.options.dev) {
      nuxt.hook('ready', () => {
        if (!existsSync(configPath)) {
          return
        }
        const watcher = watch(configPath, async () => {
          await applyRules()
        })
        nuxt.hook('close', () => watcher.close())
      })
    }
  },
})
