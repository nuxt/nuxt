import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

// Recursive find files in {srcDir}/store
const files = require.context('@/store', true, /^\.\/(?!<%= ignorePrefix %>).*\.(<%= extensions %>)$/)
const filenames = files.keys()

// Store
let storeData = {}

// Check if store/index.js exists
let indexFilename
filenames.forEach((filename) => {
  if (filename.indexOf('./index.') !== -1) {
    indexFilename = filename
  }
})
if (indexFilename) {
  storeData = getModule(indexFilename)
}

// If store is not an exported method = modules store
if (typeof storeData !== 'function') {

  // Store modules
  if (!storeData.modules) {
    storeData.modules = {}
  }

  for (let filename of filenames) {
    let name = filename.replace(/^\.\//, '').replace(/\.(<%= extensions %>)$/, '')
    if (name === 'index') continue

    let namePath = name.split(/\//)

    name = namePath[namePath.length-1]
    if (name === 'state' || name === 'getters' || name === 'actions' || name === 'mutations') {
      let module = getModuleNamespace(storeData, namePath, true)
      appendModule(module, filename, name)
      continue
    }

    //if file is foo/index.js
    //it should save as foo
    let isIndex = (name === 'index')
    if (isIndex)
      namePath.pop()

    let module      = getModuleNamespace(storeData, namePath)
    let fileModule  = getModule(filename)
    name = namePath.pop()
    module[name] = module[name] || {}

    //if file is foo.js, existing properties take priority
    //because it's the least specific case
    if (!isIndex) {
      module[name] = Object.assign({}, fileModule, module[name])
      module[name].namespaced = true
      continue
    }

    //if file is foo/index.js we want to overwrite properties from foo.js
    //but not from appended mods like foo/actions.js
    var appendedMods = {}
    if (module[name].appends) {
      appendedMods.appends = module[name].appends
      for (let append of module[name].appends)
        appendedMods[append] = module[name][append]
    }

    module[name] = Object.assign({}, module[name], fileModule, appendedMods)
    module[name].namespaced = true
  }

}

// createStore
export const createStore = storeData instanceof Function ? storeData : () => {
  return new Vuex.Store(Object.assign({
    strict: (process.env.NODE_ENV !== 'production'),
  }, storeData, {
    state: storeData.state instanceof Function ? storeData.state() : {}
  }))
}

// Dynamically require module
function getModule (filename) {
  const file = files(filename)
  const module = file.default || file
  if (module.commit) {
    throw new Error('[nuxt] store/' + filename.replace('./', '') + ' should export a method which returns a Vuex instance.')
  }
  if (module.state && typeof module.state !== 'function') {
    throw new Error('[nuxt] state should be a function in store/' + filename.replace('./', ''))
  }
  return module
}

function getModuleNamespace (storeData, namePath, forAppend = false) {
  if (namePath.length === 1) {
    if (forAppend)
      return storeData
    return storeData.modules
  }
  let namespace = namePath.shift()
  storeData.modules[namespace] = storeData.modules[namespace] || {}
  storeData.modules[namespace].namespaced = true
  storeData.modules[namespace].modules = storeData.modules[namespace].modules || {}
  return getModuleNamespace(storeData.modules[namespace], namePath, forAppend)
}

function appendModule(module, filename, name) {
  const file = files(filename)
  module.appends = module.appends || []
  module.appends.push(name)
  module[name] = file.default || file
}
