import Vue from 'vue'

const Plugin = {
  install(Vue) {
    Vue.mixin({
      created() {
        console.log('I am mixin') // eslint-disable-line no-console
      }
    })
  }
}
Vue.use(Plugin)
