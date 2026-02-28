import { useNitro } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import escapeStringRegexp from 'escape-string-regexp'
import MagicString from 'magic-string'
import { basename } from 'pathe'
import { withoutLeadingSlash } from 'ufo'
import type { Plugin } from 'vite'
import { toArray } from '../utils/index.ts'

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
    apply: () => !nuxt.options.dev && nuxt.options.experimental.entryImportMap,
    applyToEnvironment (environment) {
      if (environment.name !== 'client') {
        return false
      }
      if (environment.config.build.target) {
        const targets = toArray(environment.config.build.target)
        if (!targets.every(isSupported)) {
          return false
        }
      }
      // only apply plugin if the entry file name is hashed
      return toArray(environment.config.build.rolldownOptions?.output)
        .some(output => typeof output?.entryFileNames === 'string' && output?.entryFileNames.includes('[hash]'))
    },
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

// https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap#browser_compatibility
const supportedEnvironments = {
  chrome: 89,
  edge: 89,
  firefox: 108,
  ie: Infinity,
  ios: 16.4,
  opera: 75,
  safari: 16.4,
}

function isSupported (target: string) {
  const [engine, _version] = target.split(/(?<=[a-z])(?=\d)/)
  const constraint = supportedEnvironments[engine as keyof typeof supportedEnvironments]
  if (!constraint) {
    return true
  }
  const version = Number(_version)
  return Number.isNaN(version) || Number(version) >= constraint
}
