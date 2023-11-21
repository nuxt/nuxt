import { promises as fsp } from 'node:fs'

// TODO: swap out when https://github.com/lodash/lodash/pull/5649 is merged
import { template as lodashTemplate } from 'lodash-es'
import { genDynamicImport, genImport, genSafeVariableName } from 'knitwork'

import type { NuxtTemplate } from '@nuxt/schema'
import { logger } from '../logger'

// eslint-disable-next-line jsdoc/require-param, jsdoc/require-returns
/** @deprecated */
// TODO: Remove support for compiling ejs templates in v4
// eslint-disable-next-line ts/no-explicit-any
export async function compileTemplate (template: NuxtTemplate, context: any) {
  // eslint-disable-next-line ts/no-unsafe-assignment
  const data = { ...context, options: template.options }

  if (template.src) {
    try {
      const sourceContents = await fsp.readFile(template.src, 'utf8')

      // eslint-disable-next-line ts/no-unsafe-argument
      return lodashTemplate(sourceContents, {})(data)
    } catch (error) {
      logger.error('Error compiling template: ', template)

      throw error
    }
  }

  if (template.getContents) {
    // eslint-disable-next-line ts/no-unsafe-argument
    return template.getContents(data)
  }

  throw new Error('Invalid template: ' + JSON.stringify(template))
}

// eslint-disable-next-line jsdoc/require-param, jsdoc/require-returns
/** @deprecated */
// eslint-disable-next-line ts/no-explicit-any
const serialize = (data: any) => JSON
  .stringify(data, undefined, 2)
  .replaceAll(
    /"{(.+)}"(?=,?$)/gm,
    // eslint-disable-next-line style/max-len
    // eslint-disable-next-line ts/no-unsafe-return, ts/no-unsafe-call, ts/no-unsafe-member-access
    (r) => JSON.parse(r).replace(/^{(.*)}$/, '$1')
  )

// eslint-disable-next-line jsdoc/require-param, jsdoc/require-returns
/** @deprecated */
const importSources = (sources: string | string[], { lazy = false } = {}) => {
  if (!Array.isArray(sources)) {
    sources = [sources]
  }

  return sources.map((source) => {
    if (lazy) {
      return `const ${genSafeVariableName(source)} = ${genDynamicImport(source, { comment: `webpackChunkName: ${JSON.stringify(source)}` })}`
    }

    return genImport(source, genSafeVariableName(source))
  }).join('\n')
}

/** @deprecated */
const importName = genSafeVariableName

/** @deprecated */
export const templateUtils = { serialize, importName, importSources }
