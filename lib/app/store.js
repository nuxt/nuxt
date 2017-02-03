import Vue from 'vue'
import Vuex from 'vuex'
Vue.use(Vuex)

let files = require.context('~/store', false, /^\.\/.*\.js$/)
let filenames = files.keys()

function getModule (filename) {
  let file = files(filename)
  return file.default
    ? file.default
    : file
}

let store
let storeData = {}

// Check if store/index.js returns a vuex store
if (filenames.indexOf('./index.js') !== -1) {
  let mainModule = getModule('./index.js')
  if (mainModule.commit) {
    store = mainModule
  } else {
    storeData = mainModule
  }
}

// Generate the store if there is no store yet
if (store == null) {
  storeData.modules = storeData.modules || {}
  for (let filename of filenames) {
    let name = filename.replace(/^\.\//, '').replace(/\.js$/, '')
    if (name === 'index') continue
    storeData.modules[name] = getModule(filename)
    storeData.modules[name].namespaced = true
  }
  store = new Vuex.Store(storeData)
}

export default store
