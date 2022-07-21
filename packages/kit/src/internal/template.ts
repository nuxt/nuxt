import { promises as fsp } from 'node:fs'
import lodashTemplate from 'lodash.template'
import { genSafeVariableName, genDynamicImport, genImport } from 'knitwork'

import type { NuxtTemplate } from '@nuxt/schema'
import { relative } from 'pathe'
import { hash } from 'ohash'

export async function compileTemplate (template: NuxtTemplate, ctx: any) {
  const data = { ...ctx, options: template.options }
  if (template.src) {
    try {
      const srcContents = await fsp.readFile(template.src, 'utf-8')
      return lodashTemplate(srcContents, {})(data)
    } catch (err) {
      console.error('Error compiling template: ', template)
      throw err
    }
  }
  if (template.getContents) {
    return template.getContents(data)
  }
  throw new Error('Invalid template: ' + JSON.stringify(template))
}

const serialize = (data: any) => JSON.stringify(data, null, 2).replace(/"{(.+)}"(?=,?$)/gm, r => JSON.parse(r).replace(/^{(.*)}$/, '$1'))

const importSources = (sources: string | string[], root: string, { lazy = false } = {}) => {
  if (!Array.isArray(sources)) {
    sources = [sources]
  }
  const exports: string[] = []
  const imports: string[] = []
  for (const src of sources) {
    const path = relative(root, src)
    const variable = genSafeVariableName(path).replace(/_(45|46|47)/g, '_') + '_' + hash(path)
    exports.push(variable)
    imports.push(lazy
      ? `const ${variable} = ${genDynamicImport(src, { comment: `webpackChunkName: ${JSON.stringify(src)}` })}`
      : genImport(src, variable)
    )
  }
  return {
    exports,
    imports
  }
}

export const templateUtils = { serialize, importName: genSafeVariableName, importSources }
