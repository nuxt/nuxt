/**
 * Test extended type definitions of Vue interfaces
 * @nuxt/types/app/vue.d.ts
 */

import Vue, { ComponentOptions } from 'vue'
import { Middleware } from '..'

const options: ComponentOptions<Vue> = {}

// asyncData

options.asyncData = () => {
  return {
    foo: 'bar'
  }
}

options.asyncData = () => undefined

// fetch

options.fetch = ({ store }) => {
  return Promise.resolve('bar').then((res) => {
    store.commit('setFoo', res)
  })
}

options.fetch = async ({ store }) => {
  const res = await Promise.resolve('bar')
  store.commit('setFoo', res)
}

// key

options.key = 'foo'
options.key = to => to.fullPath

// head

const metaInfo = {
  title: 'Home',
  meta: [
    { hid: 'description', name: 'description', content: 'My custom description' }
  ]
}

options.head = metaInfo
options.head = () => metaInfo

// layout

options.layout = 'foo'
options.layout = () => 'foo'

// loading

options.loading = true

// middleware

const middlewares: Middleware[] = [
  'foo',
  () => {},
  async () => {}
]

options.middleware = middlewares
options.middleware = middlewares[0]
options.middleware = middlewares[1]
options.middleware = middlewares[2]

// scrollToTop

options.scrollToTop = true

// transition

options.transition = 'foo'
options.transition = { name: 'foo' }
options.transition = () => 'foo'
options.transition = () => {
  return { name: 'foo' }
}

// validate

options.validate = () => true
options.validate = async () => {
  const valid = await Promise.resolve(true)
  return valid
}

// watchQuery

options.watchQuery = true
options.watchQuery = ['foo', 'bar']

// $nuxt

const vm = new Vue(options)

if (vm.$nuxt.$loading.fail) { vm.$nuxt.$loading.fail() }
vm.$nuxt.$loading.finish()
if (vm.$nuxt.$loading.increase) { vm.$nuxt.$loading.increase(1) }
if (vm.$nuxt.$loading.pause) { vm.$nuxt.$loading.pause() }
vm.$nuxt.$loading.start()

vm.$nuxt.isOffline = true
vm.$nuxt.isOnline = true
