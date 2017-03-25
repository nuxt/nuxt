import Vue from 'vue'
import Vuex from 'vuex'
Vue.use(Vuex)

let files = require.context('~/store', true, /^\.\/.*\.js$/)
let filenames = files.keys()

function getModule (filename) {
  let file = files(filename)
  return file.default
    ? file.default
    : file
}

function getModuleNamespace (storeData, namePath) {
  if (namePath.length == 1) return storeData.modules

  let namespace = namePath.shift()
  
  storeData.modules[namespace] = storeData.modules[namespace] || {}
  storeData.modules[namespace].namespaced = true
  storeData.modules[namespace].modules = storeData.modules[namespace].modules || {}

  return getModuleNamespace(storeData.modules[namespace], namePath)
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

    let namePath = name.split(/\//)
    let module = getModuleNamespace(storeData, namePath)

    name = namePath.pop()
    module[name] = getModule(filename)
    module[name].namespaced = true
  }
  store = new Vuex.Store(storeData)
}

export default store
