import { ref } from 'vue'
import { useHead } from '@unhead/vue'
import { defineNuxtPlugin } from '../nuxt'

const SUPPORTED_PROTOCOLS = ['http:', 'https:']

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
      if (SUPPORTED_PROTOCOLS.some(p => url.startsWith(p)) && SUPPORTED_PROTOCOLS.includes(new URL(url).protocol)) {
        externalURLs.value.add(url)
        head?.patch({
          script: [generateRules()],
        })
      }
    })
  },
})
