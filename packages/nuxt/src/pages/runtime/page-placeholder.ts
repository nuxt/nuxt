import { defineComponent } from 'vue'
import { runtimeWarn } from '#app/utils'
import { E4014 } from '#app/error-codes'
// @ts-expect-error virtual file
import { devPagesDir } from '#build/nuxt.config.mjs'

export default defineComponent({
  name: 'NuxtPage',
  setup (_, props) {
    if (import.meta.dev) {
      runtimeWarn(`Create a Vue component in the \`${devPagesDir}/\` directory to enable \`<NuxtPage>\`.`, { code: E4014 })
    }
    return () => props.slots.default?.()
  },
})
