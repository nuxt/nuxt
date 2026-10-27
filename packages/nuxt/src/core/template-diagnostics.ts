import { normalize, relative } from 'pathe'
import { withTrailingSlash } from 'ufo'
import type { CompilerOptions } from '@vue/compiler-core'
import type { Diagnostic } from 'nostics'
import type { Component, Nuxt } from 'nuxt/schema'
import { openErrorBroadcast } from '../runtime/server/dev-error/index.ts'
import type { ErrorChannelMessage } from '../runtime/server/dev-error/index.ts'
import { createTemplateDiagnostics } from './plugins/template-diagnostics.ts'

type RouteMatcher = (path: string) => boolean

const routeMatchers = new WeakMap<Nuxt, RouteMatcher | undefined>()

/** Set the matcher static `<NuxtLink>` targets are checked against, or `undefined` to skip the check. */
export function setTemplateDiagnosticsRouteMatcher (nuxt: Nuxt, matcher: RouteMatcher | undefined): void {
  routeMatchers.set(nuxt, matcher)
}

/** Register the template diagnostics on the Vue compiler used by the Vite, webpack and rspack builders. */
export function setupTemplateDiagnostics (nuxt: Nuxt): void {
  const serverComponents = new WeakMap<Component[], Set<string>>()
  const publisher = nuxt.options.dev ? createWarningPublisher(nuxt) : undefined
  const layerDirs = nuxt.options._layers
    .map(layer => withTrailingSlash(normalize(layer.config.rootDir)))
    .filter(dir => dir === withTrailingSlash(normalize(nuxt.options.rootDir)) || !dir.includes('/node_modules/'))

  const diagnostics = createTemplateDiagnostics({
    getRouteMatcher: () => routeMatchers.get(nuxt),
    getServerComponents: () => {
      const components = nuxt.apps.default?.components
      if (!components) {
        return
      }
      let tags = serverComponents.get(components)
      if (!tags) {
        tags = resolveServerComponentTags(components)
        serverComponents.set(components, tags)
      }
      return tags
    },
    displayPath: file => relative(nuxt.options.rootDir, file),
    filter: (file) => {
      const path = normalize(file)
      return layerDirs.some(dir => path.startsWith(dir) && !path.slice(dir.length).includes('node_modules/'))
    },
    onWarning: publisher?.warn,
    onWarningResolved: publisher?.clear,
  })

  const withDiagnostics = (compilerOptions?: CompilerOptions): CompilerOptions => ({
    ...compilerOptions,
    nodeTransforms: [...compilerOptions?.nodeTransforms || [], diagnostics.nodeTransform],
  })

  nuxt.hook('build:before', () => {
    // both default to the `vue.compilerOptions` object, so each is replaced rather than mutated
    const template = (nuxt.options.vite.vue ||= {}).template ||= {}
    template.compilerOptions = withDiagnostics(template.compilerOptions)
    const loader = nuxt.options.webpack.loaders.vue
    loader.compilerOptions = withDiagnostics(loader.compilerOptions)
    const rsbuildLoader = (nuxt.options.rsbuild.vue ||= {}).vueLoaderOptions ||= {}
    rsbuildLoader.compilerOptions = withDiagnostics(rsbuildLoader.compilerOptions)
  })
}

/** Tag names of the components that only render on the server, as islands. */
function resolveServerComponentTags (components: Component[]): Set<string> {
  const tags = new Set<string>()
  for (const component of components) {
    if (component.mode !== 'server' || components.some(other => other.mode !== 'server' && other.pascalName === component.pascalName)) {
      continue
    }
    tags.add(component.pascalName)
    tags.add(component.kebabName)
    tags.add(`Lazy${component.pascalName}`)
    tags.add(`lazy-${component.kebabName}`)
  }
  return tags
}

/** Sends warnings to the dev error channel, which shows them on every open page, and retires them once fixed. */
function createWarningPublisher (nuxt: Nuxt) {
  let broadcast: ReturnType<typeof openErrorBroadcast> | undefined
  const published = new Map<Diagnostic<unknown>, Promise<string | undefined>>()
  const post = (message: ErrorChannelMessage) => (broadcast ||= openErrorBroadcast()).postMessage(message)
  const warn = (diagnostic: Diagnostic<unknown>) => {
    published.set(diagnostic, Promise.all([import('my-bad'), import('my-bad/presets')])
      .then(async ([{ createReport }, { nuxtPreset }]) => {
        const report = await createReport(diagnostic, { cwd: nuxt.options.rootDir, kind: 'warning', presets: [nuxtPreset()] })
        post({ type: 'nuxt:dev:error:warning', report })
        return report.id
      })
      .catch(() => undefined))
  }
  const clear = (diagnostic: Diagnostic<unknown>) => {
    const id = published.get(diagnostic)
    published.delete(diagnostic)
    return id?.then(id => id && post({ type: 'nuxt:dev:error:warning:clear', id })).catch(() => {})
  }
  // the channel can outlive this instance, and a restart raises the same warnings again
  nuxt.hook('close', async () => {
    await Promise.all([...published.keys()].map(clear))
    broadcast?.close()
  })
  return { warn, clear }
}
