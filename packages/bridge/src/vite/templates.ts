import hash from 'hash-sum'
import { resolve } from 'pathe'

import type { Nuxt, NuxtApp } from '@nuxt/schema'
import { genImport, genObjectFromRawEntries } from 'knitwork'

type TemplateContext = {
  nuxt: Nuxt;
  app: NuxtApp & { templateVars: Record<string, any> };
}

// TODO: Use an alias
export const middlewareTemplate = {
  filename: 'middleware.js',
  getContents (ctx: TemplateContext) {
    const { dir, router: { middleware }, srcDir } = ctx.nuxt.options
    const _middleware = ((typeof middleware !== 'undefined' && middleware) || []).map((m) => {
      // Normalize string middleware
      if (typeof m === 'string') {
        m = { src: m }
      }
      return {
        filePath: resolve(srcDir, dir.middleware, m.src),
        id: m.name || m.src.replace(/[\\/]/g, '/').replace(/\.(js|ts)$/, '')
      }
    })
    return `${_middleware.map(m => genImport(m.filePath, `$${hash(m.id)}`)).join('\n')}
const middleware = ${genObjectFromRawEntries(_middleware.map(m => [m.id, `$${hash(m.id)}`]))}
export default middleware`
  }
}

export const storeTemplate = {
  filename: 'store.js',
  getContents (ctx: TemplateContext) {
    const { dir, srcDir } = ctx.nuxt.options
    const { templateVars: { storeModules = [] } } = ctx.app
    const _storeModules = storeModules.map(s => ({
      filePath: resolve(srcDir, dir.store, s.src),
      id: (s.src
        .replace(/\.(js|ts)$/, '')
        .replace(/[\\/]/g, '/')
        .replace(/index/, '')
      ) || 'root'
    }))

    return `import Vue from 'vue'
import Vuex from 'vuex'
${_storeModules.map(s => genImport(s.filePath, { name: '*', as: `$${hash(s.id)}` })).join('\n')}
Vue.use(Vuex)

const VUEX_PROPERTIES = ['state', 'getters', 'actions', 'mutations']

const storeModules = ${genObjectFromRawEntries(_storeModules.map(m => [m.id, `$${hash(m.id)}`]))}

export function createStore() {
  let store = normalizeRoot(storeModules.root || {})
  delete storeModules.root
  for (const id in storeModules) {
    resolveStoreModules(store, storeModules[id], id)
  }
  if (typeof store === 'function') {
    return store
  }
  return new Vuex.Store(Object.assign({
    strict: (process.env.NODE_ENV !== 'production')
  }, store))
}

function normalizeRoot (moduleData, id) {
  moduleData = moduleData.default || moduleData
  if (moduleData.commit) {
    throw new Error(\`[nuxt] \${id} should export a method that returns a Vuex instance.\`)
  }
  if (typeof moduleData !== 'function') {
    // Avoid TypeError: setting a property that has only a getter when overwriting top level keys
    moduleData = { ...moduleData }
  }
  moduleData.modules = moduleData.modules || {}
  return moduleData
}

function resolveStoreModules (store, moduleData, id) {
  moduleData = moduleData.default || moduleData

  const namespaces = id.split('/').filter(Boolean)
  let moduleName = namespaces[namespaces.length - 1]

  // If src is a known Vuex property
  if (VUEX_PROPERTIES.includes(moduleName)) {
    const property = moduleName
    const propertyStoreModule = getStoreModule(store, namespaces, { isProperty: true })
    // Replace state since it's a function
    mergeProperty(propertyStoreModule, moduleData, property)
    return
  }

  const storeModule = getStoreModule(store, namespaces)

  for (const property of VUEX_PROPERTIES) {
    mergeProperty(storeModule, moduleData[property], property)
  }

  if (moduleData.namespaced === false) {
    delete storeModule.namespaced
  }
}


function getStoreModule (storeModule, namespaces, { isProperty = false } = {}) {
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

function mergeProperty (storeModule, moduleData, property) {
  if (!moduleData) {
    return
  }
  if (property === 'state') {
    storeModule.state = moduleData || storeModule.state
  } else {
    storeModule[property] = { ...storeModule[property], ...moduleData }
  }
}`
  }
}
