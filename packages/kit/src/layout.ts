import type { NuxtTemplate } from '@nuxt/schema'
import { join, parse } from 'pathe'
import { kebabCase } from 'scule'
import { useNuxt } from './context'
import { logger } from './logger'
import { addTemplate } from './template'
import { reverseResolveAlias } from 'pathe/utils'

const LAYOUT_RE = /["']/g
export function addLayout (template: NuxtTemplate | string, name?: string) {
  const nuxt = useNuxt()
  const { filename, src } = addTemplate(template)
  const layoutName = kebabCase(name || parse(filename).name).replace(LAYOUT_RE, '')

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
