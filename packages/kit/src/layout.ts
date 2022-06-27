import type { NuxtTemplate } from '@nuxt/schema'
import { join, parse, relative } from 'pathe'
import { kebabCase } from 'scule'
import { isNuxt2 } from './compatibility'
import { useNuxt } from './context'
import { logger } from './logger'
import { addTemplate } from './template'

export function addLayout (tmpl: NuxtTemplate, name?: string) {
  const nuxt = useNuxt()
  const { filename, src } = addTemplate(tmpl)
  const layoutName = kebabCase(name || parse(tmpl.filename).name).replace(/["']/g, '')

  if (isNuxt2(nuxt)) {
    // Nuxt 2 adds layouts in options
    const layout = nuxt.options.layouts[layoutName]
    if (layout) {
      return logger.warn(
        `Not overriding \`${layoutName}\` (provided by \`${layout}\`) with \`${src || filename}\`.`
      )
    }
    nuxt.options.layouts[layoutName] = `./${filename}`
    if (name === 'error') {
      this.addErrorLayout(filename)
    }
    return
  }

  // Nuxt 3 adds layouts on app
  nuxt.hook('app:templates', (app) => {
    if (layoutName in app.layouts) {
      const relativePath = relative(nuxt.options.srcDir, app.layouts[layoutName].file)
      return logger.warn(
        `Not overriding \`${layoutName}\` (provided by \`~/${relativePath}\`) with \`${src || filename}\`.`
      )
    }
    app.layouts[layoutName] = {
      file: join('#build', filename),
      name: layoutName
    }
  })
}
