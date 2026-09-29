import { defineNuxtModule } from '@nuxt/kit'

// stands in for a module (like `@nuxt/fonts`) attaching a non-script resource to a page
export default defineNuxtModule({
  meta: { name: 'font-preload' },
  setup (_options, nuxt) {
    nuxt.hook('build:manifest', (manifest) => {
      const chunk = manifest['pages/no-scripts.vue']
      if (!chunk) { return }

      chunk.assets ||= []
      chunk.assets.push('fonts/no-scripts.woff2')
      manifest['fonts/no-scripts.woff2'] = {
        file: 'fonts/no-scripts.woff2',
        resourceType: 'font',
        mimeType: 'font/woff2',
        preload: true,
      }
    })
  },
})
