import type { NuxtTemplate } from '@nuxt/schema'
import { join, parse } from 'pathe'
import { kebabCase } from 'scule'
import { isNuxt2 } from './compatibility'
import { useNuxt } from './context'
import { logger } from './logger'
import { addTemplate } from './template'
import { reverseResolveAlias } from 'pathe/utils'

const LAYOUT_RE = /["']/g
export function addLayout (this: any, template: NuxtTemplate | string, name?: string) {
  const nuxt = useNuxt()
  const { filename, src } = addTemplate(template)
  const layoutName = kebabCase(name || parse(filename).name).replace(LAYOUT_RE, '')

  if (isNuxt2(nuxt)) {
    // Nuxt 2 adds layouts in options
    const layout = (nuxt.options as any).layouts[layoutName]
    if (layout) {
      return logger.warn(
        `Not overriding \`${layoutName}\` (provided by \`${layout}\`) with \`${src || filename}\`.`,
      )
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
      const relativePath = reverseResolveAlias(app.layouts[layoutName]!.file, { ...nuxt?.options.alias || {}, ...strippedAtAliases }).pop() || app.layouts[layoutName]!.file
      return logger.warn(
        `Not overriding \`${layoutName}\` (provided by \`${relativePath}\`) with \`${src || filename}\`.`,
      )
    }
    app.layouts[layoutName] = {
      file: join('#build', filename),
      name: layoutName,
    }
  })
}

const strippedAtAliases = {
  '@': '',
  '@@': '',
}
