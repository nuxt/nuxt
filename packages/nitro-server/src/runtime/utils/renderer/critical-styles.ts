import { readFile } from 'node:fs/promises'
import { resolve } from 'pathe'
import Beasties from 'beasties'
import type { Options as BeastiesOptions } from 'beasties'
import { serverFetch } from 'nitro/app'
import { baseURL } from '../paths'
import { resolveBeastiesOptions } from './critical-styles-options'
// @ts-expect-error virtual file
import { NUXT_CLIENT_DIR } from '#internal/nuxt/nitro-config.mjs'

let beasties: Beasties | undefined

class NuxtBeasties extends Beasties {
  // Resolve stylesheets without assuming where public assets live: read from the
  // prerender output on disk, and from the running server otherwise.
  override async getCssAsset (href: string): Promise<string | undefined> {
    // Only same-origin, non-protocol-relative paths; hrefs come from build-generated links.
    if (typeof href !== 'string' || href[0] !== '/' || href[1] === '/') {
      return undefined
    }
    const path = href.replace(/\?.*$/, '')
    let css: string | undefined
    if (import.meta.prerender) {
      const base = baseURL()
      const rel = base !== '/' && path.startsWith(base) ? path.slice(base.length) : path
      const file = resolve(NUXT_CLIENT_DIR, rel.replace(/^\/+/, ''))
      if (file !== NUXT_CLIENT_DIR && !file.startsWith(NUXT_CLIENT_DIR + '/')) {
        return undefined
      }
      css = await readFile(file, 'utf-8').catch(() => undefined)
    } else {
      const res = await serverFetch(path).catch(() => undefined)
      css = res?.ok ? await res.text() : undefined
    }
    // Never inline content that could break out of the `<style>` context.
    return css && !/<\/style/i.test(css) ? css : undefined
  }

  // Critical CSS is computed in-memory; never let `pruneSource` write sheets back to disk.
  writeFile (): Promise<void> {
    return Promise.resolve()
  }
}

export function renderCriticalStyles (html: string, options: boolean | BeastiesOptions): Promise<string> {
  beasties ||= new NuxtBeasties(resolveBeastiesOptions(options))
  return beasties.process(html)
}
