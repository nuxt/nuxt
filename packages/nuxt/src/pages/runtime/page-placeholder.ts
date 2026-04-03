import { defineComponent } from 'vue'
import { runtimeErrorUtils } from '#app/utils'
import { E4014 } from '#app/error-codes'
// @ts-expect-error virtual file
import { devPagesDir } from '#build/nuxt.config.mjs'

export default defineComponent({
  name: 'NuxtPage',
  setup (_, props) {
    if (import.meta.dev) {
      runtimeErrorUtils.warn({ message: `No pages found. \`<NuxtPage>\` requires at least one page component in the \`${devPagesDir}/\` directory.`, code: E4014, fix: `Create an \`index.vue\` file inside the \`${devPagesDir}/\` directory.` })
    }
    return () => props.slots.default?.()
  },
})
