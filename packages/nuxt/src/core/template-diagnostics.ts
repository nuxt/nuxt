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
  const publishWarning = nuxt.options.dev ? createWarningPublisher(nuxt) : undefined
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
    onWarning: publishWarning,
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

/** Sends warnings to the dev error channel, which shows them on open error pages and overlays. */
function createWarningPublisher (nuxt: Nuxt): (diagnostic: Diagnostic<unknown>) => void {
  let broadcast: ReturnType<typeof openErrorBroadcast> | undefined
  nuxt.hook('close', () => broadcast?.close())
  return (diagnostic) => {
    broadcast ||= openErrorBroadcast()
    const channel = broadcast
    Promise.all([import('my-bad'), import('my-bad/presets')])
      .then(async ([{ createReport }, { nuxtPreset }]) => {
        const report = await createReport(diagnostic, { cwd: nuxt.options.rootDir, kind: 'warning', presets: [nuxtPreset()] })
        channel.postMessage({ type: 'nuxt:dev:error:warning', report } satisfies ErrorChannelMessage)
      })
      .catch(() => {})
  }
}
