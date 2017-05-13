import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

// Recursive find files in ~/store
const files = require.context('~/store', true, /^\.\/.*\.(js|ts)$/)
const filenames = files.keys()

// Store
let storeData = {}

// Check if store/index.js exists
if (filenames.indexOf('./index.js') !== -1) {
  storeData = getModule('./index.js')
}

// Store modules
if (!storeData.modules) {
  storeData.modules = {}
}

for (let filename of filenames) {
  let name = filename.replace(/^\.\//, '').replace(/\.(js|ts)$/, '')
  if (name === 'index') continue

  let namePath = name.split(/\//)
  let module = getModuleNamespace(storeData, namePath)

  name = namePath.pop()
  module[name] = getModule(filename)
  module[name].namespaced = true
}

// createStore
export const createStore = storeData instanceof Function ? storeData : () => {
  // Vuex Bug
  if (storeData.state instanceof Function) {
    return new Vuex.Store(Object.assign({}, storeData, {
      state: storeData.state()
    }))
  }
  return new Vuex.Store(storeData)
}

// Dynamically require module
function getModule (filename) {
  const file = files(filename)
  const module = file.default || file
  if (module.state && typeof module.state !== 'function') {
    // eslint-disable-next-line no-console
    console.error('[nuxt] store state should be a function.')
    return
  }
  if (module.commit) {
    // eslint-disable-next-line no-console
    console.error('[nuxt] store should export raw store options instead of an instance.')
    return
  }
  return module
}

function getModuleNamespace (storeData, namePath) {
  if (namePath.length === 1) {
    return storeData.modules
  }
  let namespace = namePath.shift()
  storeData.modules[namespace] = storeData.modules[namespace] || {}
  storeData.modules[namespace].namespaced = true
  storeData.modules[namespace].modules = storeData.modules[namespace].modules || {}
  return getModuleNamespace(storeData.modules[namespace], namePath)
}
