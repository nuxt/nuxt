import { existsSync } from 'node:fs'
import { cp, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'pathe'
import { getLayerDirectories, logger } from '@nuxt/kit'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import type { Nuxt } from '@nuxt/schema'
import { link } from 'clickable-path'
import { withTrailingSlash } from 'ufo'

import { template as defaultSpaLoadingTemplate } from './templates/spa-loading-icon.ts'

/** Static hosts commonly map unknown paths to one of these files. */
const SPA_FALLBACK_FILES = ['index.html', '200.html', '404.html']

export async function writeStaticOutput (nuxt: Nuxt, publicDir: string): Promise<void> {
  const document = resolve(publicDir, 'index.html')

  if (!existsSync(document)) {
    throw new Error(`[nuxt:vite-server] Expected \`${document}\` to exist. Did the client build run?`)
  }

  const html = await readFile(document, 'utf-8')
  await rm(resolve(publicDir, 'manifest.json'), { force: true })

  // copied after the build, which writes into this directory and empties it first
  for (const dirs of getLayerDirectories(nuxt)) {
    if (existsSync(dirs.public)) {
      await cp(dirs.public, publicDir, { recursive: true })
    }
  }

  for (const file of SPA_FALLBACK_FILES) {
    await writeFile(join(publicDir, file), html, 'utf-8')
  }

  logger.success(`Static SPA output written to ${link(publicDir)}`)
}

export async function spaLoadingTemplate (nuxt: Nuxt): Promise<string> {
  if (nuxt.options.spaLoadingTemplate === false) { return '' }

  const candidates = typeof nuxt.options.spaLoadingTemplate === 'string'
    ? [resolve(nuxt.options.srcDir, nuxt.options.spaLoadingTemplate)]
    : nuxt.options._layers.map(layer => resolve(layer.config.srcDir!, layer.config.dir?.app || 'app', 'spa-loading-template.html'))

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return (await readFile(candidate, 'utf-8')).trim()
    }
  }

  if (nuxt.options.spaLoadingTemplate === true) {
    return defaultSpaLoadingTemplate()
  }

  if (nuxt.options.spaLoadingTemplate) {
    bundlerDiagnostics.NUXT_B7016({ path: nuxt.options.spaLoadingTemplate })
  }

  return ''
}

export function publicDirs (nuxt: Nuxt): string[] {
  return getLayerDirectories(nuxt)
    .map(dirs => withTrailingSlash(dirs.public))
    .filter(dir => existsSync(dir))
}
