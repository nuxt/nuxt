import VueRouter from 'vue-router'
import { NuxtAppOptions } from '.'

declare module 'vuex/types/index' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-unused-vars
  interface Store<S> {
    app: NuxtAppOptions
    $router: VueRouter
  }
}
