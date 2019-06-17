import Store from 'vuex'
import Vue from 'vue'
import { Route } from 'vue-router'

declare module 'vuex/types/index' {
  interface Store<S> {
    app: Vue;
    route: Route;
  }
}
