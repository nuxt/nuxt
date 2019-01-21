import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

const log = console // on server-side, consola will catch all console.log
const VUEX_PROPERTIES = ['state', 'getters', 'actions', 'mutations']
let store = {}
let fileResolver

void (function updateModules() {
  fileResolver = require.context('@/<%= dir.store %>', true, /^\.\/(?!<%= ignorePrefix %>)[^.]+\.(<%= extensions %>)$/)

  // Paths are sorted from low to high priority (for overwriting properties)
  const paths = fileResolver.keys().sort((p1, p2) => {
    let res = p1.split('/').length - p2.split('/').length

    if (res === 0 && p1.includes('/index.')) {
      res = -1
    } else if (res === 0 && p2.includes('/index.')) {
      res = 1
    }
    return res
  })

  // Check if {dir.store}/index.js exists
  const indexPath = paths.find(path => path.includes('./index.'))

  if (indexPath) {
    store = requireModule(indexPath, { isRoot: true })
  }

  // If store is an exported method = classic mode (deprecated)
  if (typeof store === 'function') {
    return log.warn('Classic mode for store/ is deprecated and will be removed in Nuxt 3.')
  }

  // Enforce store modules
  store.modules = store.modules || {}

  for (const path of paths) {
    // Remove store path + extension (./foo/index.js -> foo/index)
    const namespace = path.replace(/^\.\//, '').replace(/\.(<%= extensions %>)$/, '')

    // Ignore indexFile, handled before
    if (namespace === 'index') {
      continue
    }

    const namespaces = namespace.split('/')
    let moduleName = namespaces[namespaces.length - 1]
    const moduleData = requireModule(path, { isState: moduleName === 'state' })

    // If path is a known Vuex property
    if (VUEX_PROPERTIES.includes(moduleName)) {
      const property = moduleName
      const storeModule = getStoreModule(store, namespaces, { isProperty: true })

      // Replace state since it's a function
      mergeProperty(storeModule, moduleData, property)
      continue
    }

    // If file is foo/index.js, it should be saved as foo
    const isIndexModule = (moduleName === 'index')
    if (isIndexModule) {
      namespaces.pop()
      moduleName = namespaces[namespaces.length - 1]
    }

    const storeModule = getStoreModule(store, namespaces)

    for (const property of VUEX_PROPERTIES) {
      mergeProperty(storeModule, moduleData[property], property)
    }
  }
  // If the environment supports hot reloading...
  <% if (isDev) { %>
  if (process.client && module.hot) {
    // Whenever any Vuex module is updated...
    module.hot.accept(fileResolver.id, () => {
      // Update `root.modules` with the latest definitions.
      updateModules()
      // Trigger a hot update in the store.
      window.<%= globals.nuxt %>.$store.hotUpdate(store)
    })
  }<% } %>
})()

// createStore
export const createStore = store instanceof Function ? store : () => {
  return new Vuex.Store(Object.assign({
    strict: (process.env.NODE_ENV !== 'production')
  }, store))
}

// Dynamically require module
function requireModule(path, { isRoot = false, isState = false } = {}) {
  const file = fileResolver(path)
  let moduleData = file.default || file

  if (isState && typeof moduleData !== 'function') {
    log.warn(`${path} should export a method that returns an object`)
    const state = Object.assign({}, moduleData)
    return () => state
  }
  if (isRoot && moduleData.commit) {
    throw new Error('[nuxt] <%= dir.store %>/' + path.replace('./', '') + ' should export a method that returns a Vuex instance.')
  }

  if (isRoot && typeof moduleData !== 'function') {
    // Avoid TypeError: setting a property that has only a getter when overwriting top level keys
    moduleData = Object.assign({}, moduleData)
  }
  if (moduleData.state && typeof moduleData.state !== 'function') {
    log.warn(`'state' should be a method that returns an object in ${path}`)
    const state = Object.assign({}, moduleData.state)
    // Avoid TypeError: setting a property that has only a getter when overwriting top level keys
    moduleData = Object.assign({}, moduleData, { state: () => state })
  }
  return moduleData
}

function getStoreModule(storeModule, namespaces, { isProperty = false } = {}) {
  // If ./mutations.js
  if (!namespaces.length || (isProperty && namespaces.length === 1)) {
    return storeModule
  }

  const namespace = namespaces.shift()

  storeModule.modules[namespace] = storeModule.modules[namespace] || {}
  storeModule.modules[namespace].namespaced = true
  storeModule.modules[namespace].modules = storeModule.modules[namespace].modules || {}

  return getStoreModule(storeModule.modules[namespace], namespaces, { isProperty })
}

function mergeProperty(storeModule, moduleData, property) {
  if (!moduleData) return

  if (property === 'state') {
    storeModule.state = moduleData || storeModule.state
  } else {
    storeModule[property] = Object.assign({}, storeModule[property], moduleData)
  }
}
