import { ref } from 'vue'
import { parseURL } from 'ufo'
import { defineNuxtPlugin, useHead } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  const externalURLs = ref(new Set<string>())
  useHead({
    script: [
      () => ({
        type: 'speculationrules',
        innerHTML: JSON.stringify({
          prefetch: [
            {
              source: 'list',
              urls: [...externalURLs.value],
              requires: ['anonymous-client-ip-when-cross-origin']
            }
          ]
        })
      })
    ]
  })
  nuxtApp.hook('link:prefetch', (url) => {
    const { protocol } = parseURL(url)
    if (protocol && ['http:', 'https:'].includes(protocol)) {
      externalURLs.value.add(url)
    }
  })
})
