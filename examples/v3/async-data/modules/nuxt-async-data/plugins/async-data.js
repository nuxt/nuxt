import Middleware from './middleware'
import { getMatchedComponents, sanitizeComponent, promisify, getLocation, flatMapComponents } from './utils'


if (process.client) {
  window.NUXT = window.<%= globals.context %> || {}
}

Middleware.asyncData = async function (ctx) {
  // If not components matched (will be a 404 handled by Nuxt)
  if (!ctx.route.matched.length) {
    return
  }
  if (process.server) {
    ctx.ssrContext.asyncData = ctx.ssrContext.asyncData || []
  }
  const Components = getMatchedComponents(ctx.route)
  const asyncDatas = await Promise.all(Components.map((Component) => {
    Component = sanitizeComponent(Component)
    const promises = []

    // Call asyncData(context)
    if (Component.options.asyncData && typeof Component.options.asyncData === 'function') {
      const promise = promisify(Component.options.asyncData, ctx)
      promise.then((asyncDataResult) => {
        if (process.server) {
          ctx.ssrContext.asyncData[Component.cid] = asyncDataResult
          applyAsyncData(Component)
        } else {
          applyAsyncData(Component, asyncDataResult)
        }
        return asyncDataResult
      })
      promises.push(promise)
    } else {
      promises.push(null)
    }

    // Call fetch(context)
    if (typeof Component.options.fetch === 'function' && Component.options.fetch.length === 1) {
      promises.push(Component.options.fetch(ctx))
    } else {
      promises.push(null)
    }

    return Promise.all(promises)
  }))

  // datas are the first row of each
  if (process.server) {
    ctx.ssrContext.nuxt.asyncData = asyncDatas.map(r => r[0] || {})
  }
}

// Plugin to hydrate asyncData result on client-side
export default async function ({ app }) {
  if (process.client) {
    await resolveComponents(app.router)
  }
}

function resolveComponents(router) {
  const path = getLocation(router.options.base, router.options.mode)

  return flatMapComponents(router.match(path), async (Component, _, match, key, index) => {
    // If component is not resolved yet, resolve it
    if (typeof Component === 'function' && !Component.options) {
      Component = await Component()
    }
    // Sanitize it and save it
    const _Component = applySSRData(sanitizeComponent(Component), NUXT.asyncData ? NUXT.asyncData[index] : null)
    match.components[key] = _Component
    return _Component
  })
}

function applySSRData(Component, ssrData) {
  if (NUXT.serverRendered && ssrData) {
    applyAsyncData(Component, ssrData)
  }
  Component._Ctor = Component
  return Component
}

function applyAsyncData(Component, asyncData) {
  if (
    // For SSR, we once all this function without second param to just apply asyncData
    // Prevent doing this for each SSR request
    !asyncData && Component.options.__hasNuxtData
  ) {
    return
  }

  const ComponentData = Component.options._originDataFn || Component.options.data || function () { return {} }
  Component.options._originDataFn = ComponentData

  Component.options.data = function () {
    const data = ComponentData.call(this)
    if (this.$ssrContext) {
      asyncData = this.$ssrContext.asyncData[Component.cid]
    }
    return { ...data, ...asyncData }
  }

  Component.options.__hasNuxtData = true

  if (Component._Ctor && Component._Ctor.options) {
    Component._Ctor.options.data = Component.options.data
  }
}
