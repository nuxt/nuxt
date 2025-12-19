import { ref } from 'vue'
import { defineNuxtPlugin } from '../nuxt'
import { useHead } from '../composables/head'

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:'])

export default defineNuxtPlugin({
  name: 'nuxt:cross-origin-prefetch',
  setup (nuxtApp) {
    const externalURLs = ref(new Set<string>())
    function generateRules () {
      return {
        type: 'speculationrules',
        key: 'speculationrules',
        innerHTML: JSON.stringify({
          prefetch: [
            {
              source: 'list',
              urls: [...externalURLs.value],
              requires: ['anonymous-client-ip-when-cross-origin'],
            },
          ],
        }),
      }
    }
    const head = useHead({
      script: [generateRules()],
    })
    nuxtApp.hook('link:prefetch', (url) => {
      for (const protocol of SUPPORTED_PROTOCOLS) {
        if (url.startsWith(protocol) && SUPPORTED_PROTOCOLS.has(new URL(url).protocol)) {
          externalURLs.value.add(url)
          head?.patch({ script: [generateRules()] })
          return
        }
      }
    })
  },
})
