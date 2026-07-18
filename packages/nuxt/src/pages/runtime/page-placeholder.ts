import { defineComponent } from 'vue'
import type { DefineSetupFnComponent, SlotsType, VNode } from 'vue'
import { devPagesDir } from '#build/nuxt.config.mjs'

type PagePlaceholderSlots = SlotsType<{
  default?: () => VNode[]
}>

const PagePlaceholder = defineComponent({
  name: 'NuxtPage',
  setup (_, props) {
    if (import.meta.dev) {
      console.warn(`Create a Vue component in the \`${devPagesDir}/\` directory to enable \`<NuxtPage>\``)
    }
    return () => props.slots.default?.()
  },
}) as unknown as DefineSetupFnComponent<{}, {}, PagePlaceholderSlots>

export default PagePlaceholder
