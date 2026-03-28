import type { NuxtTemplate } from '@nuxt/schema'
import { join, parse } from 'pathe'
import { kebabCase } from 'scule'
import { useNuxt } from './context.ts'
import { buildErrorUtils } from './nuxt-errors.ts'
import * as ErrorCodes from './error-codes.ts'
import { addTemplate } from './template.ts'
import { reverseResolveAlias } from 'pathe/utils'

const LAYOUT_RE = /["']/g
export function addLayout (template: NuxtTemplate | string, name?: string): void {
  const nuxt = useNuxt()
  const { filename, src } = addTemplate(template)
  const layoutName = kebabCase(name || parse(filename).name).replace(LAYOUT_RE, '')

  // Nuxt 3 adds layouts on app
  nuxt.hook('app:templates', (app) => {
    if (layoutName in app.layouts) {
      const relativePath = reverseResolveAlias(app.layouts[layoutName]!.file, { ...nuxt?.options.alias || {}, ...strippedAtAliases }).pop() || app.layouts[layoutName]!.file
      return buildErrorUtils.warn({
        message: `Not overriding \`${layoutName}\` (provided by \`${relativePath}\`) with \`${src || filename}\`.`,
        code: ErrorCodes.B4014,
        fix: 'Rename one of the layouts, or remove the duplicate layout registration.',
      })
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
