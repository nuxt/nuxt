import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

const indexPage = () => import('~/views/index.vue').then(m => m.default || m)
const aboutPage = () => import('~/views/about.vue').then(m => m.default || m)

export function createRouter() {
  return new Router({
    mode: 'history',
    routes: [
      {
        path: '/',
        component: indexPage,
        name: 'index'
      },
      {
        path: '/about',
        component: aboutPage,
        name: 'about'
      }
    ]
  })
}
