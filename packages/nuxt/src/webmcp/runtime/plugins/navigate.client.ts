import { inject } from 'vue'
import { defineNuxtPlugin } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
import { agentToolRegistryKey, defineAgentTool } from '../composables'
import { describeNavigation } from '../navigate'

export default defineNuxtPlugin({
  name: 'nuxt:agent-tools:navigate',
  dependsOn: ['nuxt:agent-tools'],
  setup (nuxtApp) {
    const registry = nuxtApp.vueApp.runWithContext(() => inject(agentToolRegistryKey, null))
    const router = useRouter()
    const pages = [...new Set(router.getRoutes().map(route => route.path).filter(path => !path.includes('pathMatch')))]
    if (!registry || !pages.length) {
      return
    }
    registry.activate(defineAgentTool<{ path: string }>({
      name: 'navigate',
      description: describeNavigation(pages),
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'The path to open, with any dynamic segments filled in.' } },
        required: ['path'],
      },
      async execute ({ path }) {
        const failure = await router.push(path)
        if (failure) {
          throw new Error(`Could not open ${path}.`)
        }
        return { path: router.currentRoute.value.fullPath, title: document.title }
      },
    }))
  },
})
