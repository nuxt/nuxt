import Vue from 'vue'
import Vuex from 'vuex'
Vue.use(Vuex)

const files = require.context('~store', false, /^\.\/.*\.js$/)

const storeData = { modules: {} }
for (let filename of files.keys()) {
  let name = filename.replace(/^\.\//, '').replace(/\.js$/, '')
  if (name === 'index') {
    Object.assign(storeData, files(filename))
  } else {
    storeData.modules[name] = files(filename)
    storeData.modules[name].namespaced = true
  }
}

export default new Vuex.Store(storeData)
