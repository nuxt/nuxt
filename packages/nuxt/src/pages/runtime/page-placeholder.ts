import { defineComponent } from 'vue'
import type { DefineSetupFnComponent, SlotsType, VNode } from 'vue'
import { renderDiagnostics } from '../../app/diagnostics/render'
import { devPagesDir } from '#build/nuxt.config.mjs'

type PagePlaceholderSlots = SlotsType<{
  default?: () => VNode[]
}>

const PagePlaceholder = defineComponent({
  name: 'NuxtPage',
  setup (_, props) {
    if (import.meta.dev) {
      renderDiagnostics.NUXT_E4014({ dir: devPagesDir })
    }
    return () => props.slots.default?.()
  },
}) as unknown as DefineSetupFnComponent<{}, {}, PagePlaceholderSlots>

export default PagePlaceholder
