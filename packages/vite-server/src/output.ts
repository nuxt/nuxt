import { existsSync } from 'node:fs'
import { cp, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'pathe'
import { getLayerDirectories, logger } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { link } from 'clickable-path'
import { withTrailingSlash } from 'ufo'

/** Static hosts commonly map unknown paths to one of these files. */
const SPA_FALLBACK_FILES = ['index.html', '200.html', '404.html']

export async function writeStaticOutput (nuxt: Nuxt, publicDir: string, options: { ssr?: boolean, prerender?: boolean } = {}): Promise<void> {
  const document = resolve(publicDir, 'index.html')

  if (!existsSync(document)) {
    throw new Error(`[nuxt:vite-server] Expected \`${document}\` to exist. Did the client build run?`)
  }

  const html = await readFile(document, 'utf-8')
  await rm(resolve(publicDir, 'manifest.json'), { force: true })

  // the document is a client build input, but a server build renders its own
  if (options.ssr) {
    await rm(document, { force: true })
  }

  // copied after the build, which writes into this directory and empties it first
  for (const dirs of getLayerDirectories(nuxt)) {
    if (existsSync(dirs.public)) {
      await cp(dirs.public, publicDir, { recursive: true })
    }
  }

  if (options.ssr) {
    if (!options.prerender) {
      logger.success(`Server output written to ${link(resolve(publicDir, '..'))}`)
    }
    return
  }

  for (const file of SPA_FALLBACK_FILES) {
    await writeFile(join(publicDir, file), html, 'utf-8')
  }

  logger.success(`Static SPA output written to ${link(publicDir)}`)
}

/** Drop the bundle the crawl rendered with, leaving the static site as the whole output. */
export async function finishStaticOutput (outputDir: string, publicDir: string): Promise<void> {
  await rm(join(outputDir, 'server'), { recursive: true, force: true })

  logger.success(`Prerendered output written to ${link(publicDir)}`)
}

export function publicDirs (nuxt: Nuxt): string[] {
  return getLayerDirectories(nuxt)
    .map(dirs => withTrailingSlash(dirs.public))
    .filter(dir => existsSync(dir))
}
