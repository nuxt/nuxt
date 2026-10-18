import { setBuildOutput } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import escapeStringRegexp from 'escape-string-regexp'
import { generateTransform, rolldownString } from 'rolldown-string'
import { basename } from 'pathe'
import { withoutLeadingSlash } from 'ufo'
import type { Plugin } from 'vite'
import { toArray } from '../utils/index.ts'

export function StableEntryPlugin (nuxt: Nuxt): Plugin {
  let entryFileName: string | undefined
  let entryChunkFileName: string | undefined

  setBuildOutput('entryChunkName', () => `export const entryFileName = ${JSON.stringify(entryFileName)}`)

  return {
    name: 'nuxt:stable-entry',
    apply: () => !nuxt.options.dev && nuxt.options.experimental.entryImportMap,
    configEnvironment (name, config) {
      if (name !== 'client' || config.build?.modulePreload === false) {
        return
      }
      const modulePreload = typeof config.build?.modulePreload === 'object' ? config.build.modulePreload : {}
      const resolveDependencies = modulePreload.resolveDependencies
      return {
        build: {
          modulePreload: {
            ...modulePreload,
            // the entry is a static import of any chunk that would preload it, so it is
            // already loaded. Leaving it in the list would reinject its hash into chunks
            // whose rendered content no longer references it, so the same [hash] filename
            // could be emitted with different content across builds
            resolveDependencies: (filename, deps, context) => {
              const resolved = resolveDependencies ? resolveDependencies(filename, deps, context) : deps
              return entryChunkFileName ? resolved.filter(dep => dep !== entryChunkFileName) : resolved
            },
          },
        },
      }
    },
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
      const s = rolldownString(code, chunk.fileName)
      s.replaceAll(filename, '#entry')

      return generateTransform(s, chunk.fileName)
    },
    generateBundle: {
      order: 'pre',
      handler (_options, bundle) {
        entryChunkFileName = Object.values(bundle).find(chunk => chunk.type === 'chunk' && chunk.isEntry && chunk.name === 'entry')?.fileName
      },
    },
    writeBundle () {
      let entry = entryChunkFileName
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
