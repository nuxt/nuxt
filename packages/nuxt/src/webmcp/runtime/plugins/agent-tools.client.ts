import { nextTick } from 'vue'
import { defineNuxtPlugin } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
import { agentToolDiagnostics } from '../../../app/diagnostics/agent-tools'
import type { AgentToolDiagnostics, ModelContextLike } from '../registry'
import { createAgentToolRegistry } from '../registry'
import { highlight } from '../dom'
import { agentToolRegistryKey } from '../composables'
import { createAgentToolDirective, createSubmitCapture } from '../directive'

function getModelContext (): ModelContextLike | undefined {
  return (document as { modelContext?: ModelContextLike }).modelContext ?? (navigator as { modelContext?: ModelContextLike }).modelContext
}

export default defineNuxtPlugin({
  name: 'nuxt:agent-tools',
  setup (nuxtApp) {
    const router = useRouter()
    let navigation: Promise<void> | undefined
    let finishNavigation: (() => void) | undefined

    const diagnostics: AgentToolDiagnostics | undefined = import.meta.dev
      ? {
          registerFailed: (tool, cause) => agentToolDiagnostics.NUXT_E9001({ tool, cause }),
          duplicate: tool => agentToolDiagnostics.NUXT_E9002({ tool }),
          lint: (tool, problems) => agentToolDiagnostics.NUXT_E9003({ tool, problems }),
          longResult: (tool, length) => agentToolDiagnostics.NUXT_E9004({ tool, length }),
        }
      : undefined

    const registry = createAgentToolRegistry({
      modelContext: getModelContext,
      highlight,
      schedule: flush => setTimeout(flush),
      diagnostics,
      onChange: import.meta.dev && import.meta.hot
        ? tools => import.meta.hot!.send('nuxt:agent-tools', { path: router.currentRoute.value.path, tools })
        : undefined,
      observe () {
        const before = router.currentRoute.value.fullPath
        return async () => {
          await nextTick()
          await new Promise(resolve => setTimeout(resolve))
          if (navigation) {
            await Promise.race([navigation, new Promise(resolve => setTimeout(resolve, 5000))])
          }
          const after = router.currentRoute.value.fullPath
          if (after !== before) {
            return `The page is now ${after}.`
          }
        }
      },
    })

    nuxtApp.hook('page:start', () => {
      if (!navigation) {
        registry.hold()
        navigation = new Promise(resolve => (finishNavigation = resolve))
      }
    })
    for (const hook of ['page:finish', 'app:suspense:resolve'] as const) {
      nuxtApp.hook(hook, () => {
        if (navigation) {
          finishNavigation?.()
          navigation = finishNavigation = undefined
          registry.release()
        }
      })
    }

    const submits = createSubmitCapture()
    nuxtApp.vueApp.provide(agentToolRegistryKey, registry)
    nuxtApp.vueApp.directive('agent-tool', createAgentToolDirective(registry, submits))
    nuxtApp.vueApp.config.globalProperties.$agentTools = { capture: submits.capture }
  },
})
