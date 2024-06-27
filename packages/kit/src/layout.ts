import type { NuxtTemplate } from '@nuxt/schema'
import { join, parse, relative } from 'pathe'
import { kebabCase } from 'scule'
import { useNuxt } from './context'
import { logger } from './logger'
import { addTemplate } from './template'

export function addLayout (this: any, template: NuxtTemplate | string, name?: string) {
  const nuxt = useNuxt()
  const { filename, src } = addTemplate(template)
  const layoutName = kebabCase(name || parse(filename).name).replace(/["']/g, '')

  // Nuxt 3 adds layouts on app
  nuxt.hook('app:templates', (app) => {
    if (layoutName in app.layouts) {
      const relativePath = relative(nuxt.options.srcDir, app.layouts[layoutName]!.file)
      return logger.warn(
        `Not overriding \`${layoutName}\` (provided by \`~/${relativePath}\`) with \`${src || filename}\`.`,
      )
    }
    app.layouts[layoutName] = {
      file: join('#build', filename),
      name: layoutName,
    }
  })
}
