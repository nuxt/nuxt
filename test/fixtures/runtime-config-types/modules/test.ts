import { defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'some-module',
  },
  setup (_, nuxt) {
    // @ts-expect-error this should be typed
    nuxt.options.runtimeConfig.public.setByModule = 'module'
  },
})

declare module 'nuxt/schema' {
  interface PublicRuntimeConfig {
    setByModule?: 'modules'
  }
}
