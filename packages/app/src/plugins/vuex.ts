import { createVuex, defineStore, useStore } from 'vuex5/dist/vuex.esm'
import type { Plugin } from 'nuxt/app'
import { useHydration } from 'nuxt/app/composables'

export default <Plugin> function ({ app }) {
  const vuex = createVuex({ })

  app.use(vuex)

  useHydration('vuex',
    () => vuex.registry,
    state => () => {
      // eslint-disable-next-line no-console
      console.log('vuex.replaceStateTree', state)
      // vuex.replaceStateTree(state)
    }
  )
}

export function createStore (arg1: any, arg2?: any) {
  const store = defineStore(arg1, arg2)

  return () => useStore(store)
}
