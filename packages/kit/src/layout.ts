import type { NuxtTemplate } from '@nuxt/schema'
import { join, parse, relative } from 'pathe'
import { kebabCase } from 'scule'
import { isNuxt2 } from './compatibility'
import { useNuxt } from './context'
import { logger } from './logger'
import { addTemplate } from './template'

/**
 * Register template as layout and add it to the layouts.
 * @param this - Nuxt 2 instance
 * @param template - A template object or a string with the path to the template. If a string is provided, it will be converted to a template object with src set to the string value. If a template object is provided, it must have the {@link https://nuxt.com/docs/api/kit/layout#layout following properties}.
 * @param name - Custom name of the template.
 * @see {@link https://nuxt.com/docs/api/kit/layout#addlayout documentation}
 */
export function addLayout (
  this: any,
  template: NuxtTemplate | string,
  name?: string
) {
  const nuxt = useNuxt()
  const { filename, src } = addTemplate(template)
  const layoutName = kebabCase(name || parse(filename).name).replaceAll(/["']/g, '')

  if (isNuxt2(nuxt)) {
    // Nuxt 2 adds layouts in options
    const layout = (nuxt.options as any).layouts[layoutName]

    if (layout) {
      logger.warn(
        `Not overriding \`${layoutName}\` (provided by \`${layout}\`) with \`${src || filename}\`.`
      )

      return
    }

    (nuxt.options as any).layouts[layoutName] = `./${filename}`

    if (name === 'error') {
      this.addErrorLayout(filename)
    }

    return
  }

  // Nuxt 3 adds layouts on app
  nuxt.hook('app:templates', (app) => {
    if (layoutName in app.layouts) {
      const relativePath = relative(
        nuxt.options.srcDir, app.layouts[layoutName].file
      )

      logger.warn(
        `Not overriding \`${layoutName}\` (provided by \`~/${relativePath}\`) with \`${src || filename}\`.`
      )

      return
    }

    app.layouts[layoutName] = {
      file: join('#build', filename),
      name: layoutName
    }
  })
}
