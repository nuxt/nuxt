import { readFile } from 'node:fs/promises'
import { resolve } from 'pathe'
import type { Nuxt } from '@nuxt/schema'

import { bundlerDiagnostics } from '../diagnostics/bundler.ts'
import { findPath } from '../resolve.ts'
import { template as defaultSpaLoadingTemplate } from './templates/spa-loading-icon.ts'

/** Path of the configured SPA loading template, or of the `app/spa-loading-template.html` it would be read from. */
export async function resolveSpaLoadingTemplatePath (nuxt: Nuxt): Promise<string> {
  if (typeof nuxt.options.spaLoadingTemplate === 'string') {
    return resolve(nuxt.options.srcDir, nuxt.options.spaLoadingTemplate)
  }

  const possiblePaths = nuxt.options._layers.map(layer => resolve(layer.config.srcDir, layer.config.dir?.app || 'app', 'spa-loading-template.html'))

  return await findPath(possiblePaths) ?? resolve(nuxt.options.srcDir, nuxt.options.dir?.app || 'app', 'spa-loading-template.html')
}

/** HTML rendered while a client-only page loads, as configured by `spaLoadingTemplate`. */
export async function resolveSpaLoadingTemplate (nuxt: Nuxt): Promise<string> {
  if (nuxt.options.spaLoadingTemplate === false) { return '' }

  const path = await resolveSpaLoadingTemplatePath(nuxt)
  const contents = await readFile(path, 'utf-8').catch(() => undefined)
  if (contents !== undefined) {
    return contents.trim()
  }

  if (nuxt.options.spaLoadingTemplate === true) {
    return defaultSpaLoadingTemplate()
  }

  if (nuxt.options.spaLoadingTemplate) {
    bundlerDiagnostics.NUXT_B7016({ path: nuxt.options.spaLoadingTemplate })
  }

  return ''
}
