import { kebabCase, pascalCase } from 'scule'
import { type Component, type ComponentsDir } from '@nuxt/schema'
import { useNuxt } from './context'
import { logger } from './logger'
import { assertNuxtCompatibility } from './compatibility'

/**
 * Register a directory to be scanned for components and imported only when used. Keep in mind, that this does not register components globally, until you specify `global: true` option.
 *
 * **Note:** Requires Nuxt 2.13+
 * @param directory - An object with the {@link https://nuxt.com/docs/api/kit/components#dir following properties}.
 * @see {@link https://nuxt.com/docs/api/kit/components#addcomponentsdir documentation}
 */
export async function addComponentsDir(directory: ComponentsDir) {
  const nuxt = useNuxt()

  await assertNuxtCompatibility({ nuxt: '>=2.13' }, nuxt)

  nuxt.options.components = nuxt.options.components || []

  directory.priority ??= 0

  nuxt.hook('components:dirs', (directories) => {
    directories.push(directory)
  })
}

export type AddComponentOptions = {
  name: string
  filePath: string
} & Partial<
  Exclude<
    Component,
    'shortPath' | 'async' | 'level' | 'import' | 'asyncImport'
  >
>

/**
 * Register a component to be automatically imported.
 *
 * **Note:** Requires Nuxt 2.13+
 * @param options - An object with the {@link https://nuxt.com/docs/api/kit/components#options following properties}.
 * @see {@link https://nuxt.com/docs/api/kit/components#addcomponent documentation}
 */
export async function addComponent(options: AddComponentOptions) {
  const nuxt = useNuxt()

  await assertNuxtCompatibility({ nuxt: '>=2.13' }, nuxt)

  nuxt.options.components = nuxt.options.components || []

  // Apply defaults
  const component: Component = {
    export: options.export || 'default',
    chunkName: 'components/' + kebabCase(options.name),
    global: options.global ?? false,
    kebabName: kebabCase(options.name || ''),
    pascalName: pascalCase(options.name || ''),
    prefetch: false,
    preload: false,
    mode: 'all',
    shortPath: options.filePath,
    priority: 0,
    ...options
  }

  nuxt.hook('components:extend', (components: Component[]) => {
    const existingComponent = components.find(
      (c) => (
        c.pascalName === component.pascalName
        || c.kebabName === component.kebabName
      ) && c.mode === component.mode
    )

    if (existingComponent) {
      const existingPriority = existingComponent.priority ?? 0
      const newPriority = component.priority ?? 0

      if (newPriority < existingPriority) {
        return
      }

      // We override where new component priority is equal or higher
      // but we warn if they are equal.
      if (newPriority === existingPriority) {
        const name = existingComponent.pascalName || existingComponent.kebabName

        logger.warn(`Overriding ${name} component. You can specify a \`priority\` option when calling \`addComponent\` to avoid this warning.`)
      }

      Object.assign(existingComponent, component)
    } else {
      components.push(component)
    }
  })
}
