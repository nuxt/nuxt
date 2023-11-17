import { type Nitro, type NitroDevEventHandler, type NitroEventHandler } from 'nitropack'
import { type Import } from 'unimport'
import { normalize } from 'pathe'
import { useNuxt } from './context'
import { toArray } from './utils'

function normalizeHandlerMethod(handler: NitroEventHandler) {
  // retrieve method from handler file name
  const [, method] = handler.handler.match(
    /\.(get|head|patch|post|put|delete|connect|options|trace)(\.\w+)*$/
  ) || []

  return {
    method,
    ...handler,
    handler: normalize(handler.handler)
  }
}

/**
 * Adds a Nitro server handler. Use it if you want to create server middleware or custom route.
 * @param handler - A handler object with the {@link https://nuxt.com/docs/api/kit/nitro#handler following properties}.
 * @see {@link https://nuxt.com/docs/api/kit/nitro#addserverhandler documentation}
 */
export function addServerHandler(handler: NitroEventHandler) {
  useNuxt().options.serverHandlers.push(normalizeHandlerMethod(handler))
}

/**
 * Adds a Nitro server handler to be used only in development mode. This handler will be excluded from production build.
 * @param handler - A handler object with the {@link https://nuxt.com/docs/api/kit/nitro#handler-1 following properties}.
 * @see {@link https://nuxt.com/docs/api/kit/nitro#adddevserverhandler documentation}
 */
export function addDevServerHandler(handler: NitroDevEventHandler) {
  useNuxt().options.devServerHandlers.push(handler)
}

/**
 * Add plugin to extend Nitro's runtime behavior.
 * @param plugin - Path to the plugin. The plugin must export a function that accepts Nitro instance as an argument.
 * @see {@link https://nuxt.com/docs/api/kit/nitro#addserverplugin documentation}
 */
export function addServerPlugin(plugin: string) {
  const nuxt = useNuxt()

  nuxt.options.nitro.plugins = nuxt.options.nitro.plugins || []

  nuxt.options.nitro.plugins.push(normalize(plugin))
}

/**
 * Add routes to be prerendered to Nitro.
 * @param routes - A route or an array of routes to prerender.
 * @see {@link https://nuxt.com/docs/api/kit/nitro#addprerenderroutes documentation}
 */
export function addPrerenderRoutes(routes: string | string[]) {
  const nuxt = useNuxt()

  if (!Array.isArray(routes)) {
    routes = [routes]
  }

  routes = routes.filter(Boolean)

  if (routes.length === 0) {
    return
  }

  nuxt.hook('prerender:routes', (context) => {
    for (const route of routes) {
      context.routes.add(route)
    }
  })
}

/**
 * Access to the Nitro instance
 *
 * **Note:** You can call `useNitro()` only after `ready` hook.
 *
 * **Note:** Changes to the Nitro instance configuration are not applied.
 * @example
 * ```ts
 * nuxt.hook('ready', () => {
 *   console.log(useNitro())
 * })
 * ```
 * @returns Nitro instance
 * @throws Will throw an error if Nitro is not initialized yet.
 * @see {@link https://nuxt.com/docs/api/kit/nitro#usenitro documentation}
 */
export function useNitro(): Nitro {
  const nuxt = useNuxt()

  // eslint-disable-next-line style/max-len
  // eslint-disable-next-line ts/no-unsafe-assignment, ts/no-unsafe-member-access, ts/no-explicit-any
  const nitro = (nuxt as any)._nitro

  if (!nitro) {
    throw new Error('Nitro is not initialized yet. You can call `useNitro()` only after `ready` hook.')
  }

  // eslint-disable-next-line ts/no-unsafe-return
  return nitro
}

/**
 * Add server imports to be auto-imported by Nitro.
 * @param imports - An array of imports to be added.
 */
export function addServerImports(imports: Import[]) {
  const nuxt = useNuxt()

  nuxt.hook('nitro:config', (config) => {
    config.imports ||= {}

    config.imports.imports ||= []

    config.imports.imports.push(...imports)
  })
}

/**
 * Add directories to be scanned for auto-imports by Nitro.
 * @param directories - A directory or an array of directories to register to be scanned by Nitro.
 * @param options - Options to pass to the import.
 * @param options.prepend - If set to `true`, the directories will be prepended to the list.
 * @see {@link https://nuxt.com/docs/api/kit/nitro#addserverimportsdir documentation}
 */
export function addServerImportsDir(
  directories: string | string[],
  options: { prepend?: boolean } = {}
) {
  const nuxt = useNuxt()

  nuxt.hook('nitro:config', (config) => {
    config.imports ||= {}

    config.imports.dirs ||= []

    config.imports.dirs[options.prepend ? 'unshift' : 'push'](...toArray(directories))
  })
}
