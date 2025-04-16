import { kebabCase, pascalCase } from 'scule'
import type { Component, ComponentsDir } from '@nuxt/schema'
import { resolveModuleExportNames } from 'mlly'

import { useNuxt } from './context'
import { checkNuxtVersion } from './compatibility'
import { logger } from './logger'
import { resolvePath } from './resolve'
import { MODE_RE } from './utils'

/**
 * Register a directory to be scanned for components and imported only when used.
 *
 * Requires Nuxt 2.13+
 */
export function addComponentsDir (dir: ComponentsDir, opts: { prepend?: boolean } = {}) {
  const nuxt = useNuxt()
  if (!checkNuxtVersion('>=2.13', nuxt)) {
    throw new Error(`\`addComponentsDir\` requires Nuxt 2.13 or higher.`)
  }
  nuxt.options.components ||= []
  dir.priority ||= 0
  nuxt.hook('components:dirs', (dirs) => { dirs[opts.prepend ? 'unshift' : 'push'](dir) })
}

export type AddComponentOptions = { name: string, filePath: string } & Partial<Exclude<Component,
'shortPath' | 'async' | 'level' | 'import' | 'asyncImport'
>>

/**
 * This utility takes a file path or npm package that is scanned for named exports, which are get added automatically
 */
export function addComponentExports (opts: Omit<AddComponentOptions, 'name'> & { prefix?: string }) {
  const nuxt = useNuxt()
  const components: Component[] = []
  nuxt.hook('components:dirs', async () => {
    const filePath = await resolvePath(opts.filePath)

    const names = await resolveModuleExportNames(filePath, { extensions: nuxt.options.extensions })
    components.length = 0
    for (const name of names) {
      components.push(normalizeComponent({ name: pascalCase([opts.prefix || '', name === 'default' ? '' : name]), export: name, ...opts }))
    }
  })
  addComponents(components)
}

/**
 * Register a component by its name and filePath.
 *
 * Requires Nuxt 2.13+
 */
export function addComponent (opts: AddComponentOptions) {
  const component = normalizeComponent(opts)
  addComponents([component])
}

function addComponents (addedComponents: Component[]) {
  const nuxt = useNuxt()
  if (!checkNuxtVersion('>=2.13', nuxt)) {
    throw new Error(`\`addComponent\` requires Nuxt 2.13 or higher.`)
  }

  nuxt.options.components ||= []

  nuxt.hook('components:extend', (components: Component[]) => {
    for (const component of addedComponents) {
      const existingComponentIndex = components.findIndex(c => (c.pascalName === component.pascalName || c.kebabName === component.kebabName) && c.mode === component.mode)
      if (existingComponentIndex !== -1) {
        const existingComponent = components[existingComponentIndex]!
        const existingPriority = existingComponent.priority ?? 0
        const newPriority = component.priority ?? 0

        if (newPriority < existingPriority) { return }

        // We override where new component priority is equal or higher
        // but we warn if they are equal.
        if (newPriority === existingPriority) {
          const name = existingComponent.pascalName || existingComponent.kebabName
          logger.warn(`Overriding ${name} component. You can specify a \`priority\` option when calling \`addComponent\` to avoid this warning.`)
        }
        components.splice(existingComponentIndex, 1, component)
      } else {
        components.push(component)
      }
    }
  })
}

function normalizeComponent (opts: AddComponentOptions) {
  if (!opts.mode) {
    const [, mode = 'all'] = opts.filePath.match(MODE_RE) || []
    opts.mode = mode as 'all' | 'client' | 'server'
  }

  // Apply defaults
  const component: Component = {
    export: opts.export || 'default',
    chunkName: 'components/' + kebabCase(opts.name),
    global: opts.global ?? false,
    kebabName: kebabCase(opts.name || ''),
    pascalName: pascalCase(opts.name || ''),
    prefetch: false,
    preload: false,
    mode: 'all',
    shortPath: opts.filePath,
    priority: 0,
    meta: {},
    ...opts,
  }

  return component
}
