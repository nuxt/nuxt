import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

export function createRouter () {
  return new Router({
    mode: 'history',
    routes: [
      {
        path: '/',
        component: require('~/views/index.vue'),
        name: 'index'
      },
      {
        path: '/about',
        component: require('~/views/about.vue'),
        name: 'about'
      }
    ]
  })
}
