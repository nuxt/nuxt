import type { NuxtImport, NuxtServerTemplate } from '@nuxt/schema'

import { addDevServerHandler, addServerHandler, addServerImports, addServerImportsDir, addServerPlugin } from './nitro.ts'
import { addServerTemplate } from './template.ts'
import type { NitroCompatibilityVersion, NitroDevEventHandlerV2, NitroDevEventHandlerV3, NitroEventHandlerV2, NitroEventHandlerV3 } from './nitro-types.ts'

export interface NitroHelpers<Version extends NitroCompatibilityVersion> {
  addServerHandler: (handler: Version extends 3 ? NitroEventHandlerV3 : NitroEventHandlerV2) => void
  addDevServerHandler: (handler: Version extends 3 ? NitroDevEventHandlerV3 : NitroDevEventHandlerV2) => void
  addServerPlugin: (plugin: string) => void
  addServerImports: (imports: NuxtImport | NuxtImport[]) => void
  addServerImportsDir: (dirs: string | string[], opts?: { prepend?: boolean }) => void
  addServerTemplate: (template: NuxtServerTemplate) => NuxtServerTemplate
}

/**
 * Create server registration helpers bound to a nitro major version.
 *
 * The bound helpers accept exactly the handler shapes of that version and pass the
 * version explicitly on every call, saving a module written for a single nitro major
 * from repeating `{ version }` on each registration.
 *
 * @example
 * ```ts
 * const nitro3 = createNitroHelpers({ version: 3 })
 * nitro3.addServerHandler({ route: '/api/test', handler: resolve('./runtime/server/test') })
 * ```
 */
export function createNitroHelpers<Version extends NitroCompatibilityVersion> (options: { version: Version }): NitroHelpers<Version> {
  const { version } = options
  return {
    addServerHandler: handler => (addServerHandler as (handler: unknown, options: { version: NitroCompatibilityVersion }) => void)(handler, { version }),
    addDevServerHandler: handler => (addDevServerHandler as (handler: unknown, options: { version: NitroCompatibilityVersion }) => void)(handler, { version }),
    addServerPlugin: plugin => addServerPlugin(plugin, { version }),
    addServerImports: imports => addServerImports(imports, { version }),
    addServerImportsDir: (dirs, opts) => addServerImportsDir(dirs, { ...opts, version }),
    addServerTemplate: template => addServerTemplate(template, { version }),
  }
}
