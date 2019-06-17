import Store from 'vuex'
import Vue from 'vue'
import VueRouter from 'vue-router'

declare module 'vuex/types/index' {
  interface Store<S> {
    app: Vue;
    $router: VueRouter;
  }
}
