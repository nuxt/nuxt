import { useNitro } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import escapeStringRegexp from 'escape-string-regexp'
import MagicString from 'magic-string'
import { basename } from 'pathe'
import { withoutLeadingSlash } from 'ufo'
import type { Plugin } from 'vite'

export function StableEntryPlugin (nuxt: Nuxt): Plugin {
  let sourcemap: boolean
  let entryFileName: string | undefined

  const nitro = useNitro()

  nitro.options.virtual ||= {}
  nitro.options._config.virtual ||= {}

  nitro.options._config.virtual['#internal/entry-chunk.mjs'] = nitro.options.virtual['#internal/entry-chunk.mjs'] = () => `export const entryFileName = ${JSON.stringify(entryFileName)}`

  return {
    name: 'nuxt:stable-entry',
    configResolved (config) {
      sourcemap = !!config.build.sourcemap
    },
    applyToEnvironment: environment => environment.name === 'client',
    apply: () => !nuxt.options.dev && nuxt.options.experimental.entryImportMap,
    renderChunk (code, chunk, _options, meta) {
      const entry = Object.values(meta.chunks).find(chunk => chunk.isEntry && chunk.name === 'entry')?.fileName
      if (!entry || !chunk.imports.includes(entry)) {
        return
      }

      const filename = new RegExp(`(?<=['"])[\\./]*${escapeStringRegexp(basename(entry))}`, 'g')
      const s = new MagicString(code)
      s.replaceAll(filename, '#entry')

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: sourcemap ? s.generateMap({ hires: true }) : undefined,
        }
      }
    },
    writeBundle (_options, bundle) {
      let entry = Object.values(bundle).find(chunk => chunk.type === 'chunk' && chunk.isEntry && chunk.name === 'entry')?.fileName
      const prefix = withoutLeadingSlash(nuxt.options.app.buildAssetsDir)
      if (entry?.startsWith(prefix)) {
        entry = entry.slice(prefix.length)
      }
      entryFileName = entry
    },
  }
}
