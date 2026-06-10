import { addVitePlugin, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'worker-module' },
  setup () {
    addVitePlugin({ name: 'test:worker-appended' }, { worker: true })
    addVitePlugin({ name: 'test:worker-prepended' }, { worker: true, prepend: true })
    addVitePlugin({ name: 'test:not-on-worker' })
  },
})
