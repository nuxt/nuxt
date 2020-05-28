import Store from 'vuex'
import VueRouter from 'vue-router'
import { NuxtAppOptions } from '.'

declare module 'vuex/types/index' {
  interface Store<S> {
    app: NuxtAppOptions
    $router: VueRouter
  }
}
