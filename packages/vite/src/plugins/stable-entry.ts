import { useNitro } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import escapeStringRegexp from 'escape-string-regexp'
import MagicString from 'magic-string'
import { basename, dirname, relative, resolve } from 'pathe'
import { withoutLeadingSlash } from 'ufo'
import type { Plugin } from 'vite'
import { toArray } from '../utils/index.ts'

interface StableAlias {
  alias: string
  chunkName: string
  exportName: string
}

export function StableEntryPlugin (nuxt: Nuxt): Plugin {
  const enabled = !nuxt.options.dev && nuxt.options.experimental.entryImportMap
  if (!enabled) {
    return {
      name: 'nuxt:stable-entry',
      apply: () => false,
    }
  }

  let sourcemap: boolean
  const stablePreloadFiles = new Set<string>()

  const routesPath = resolve(nuxt.options.buildDir, 'routes.mjs')
  const layoutsPath = resolve(nuxt.options.buildDir, 'layouts.mjs')

  const aliases: StableAlias[] = [
    { alias: '#entry', chunkName: 'entry', exportName: 'entryFileName' },
    { alias: '#routes', chunkName: 'routes', exportName: 'routesFileName' },
    { alias: '#layouts', chunkName: 'layouts', exportName: 'layoutsFileName' },
  ]

  const fileNames: Record<string, string | undefined> = {}
  for (const a of aliases) {
    fileNames[a.exportName] = undefined
  }

  const renderVirtual = () => aliases
    .map(a => `export const ${a.exportName} = ${JSON.stringify(fileNames[a.exportName])}`)
    .join('\n')

  const nitro = useNitro()

  nitro.options.virtual ||= {}
  nitro.options._config.virtual ||= {}

  nitro.options._config.virtual['#internal/entry-chunk.mjs'] = nitro.options.virtual['#internal/entry-chunk.mjs'] = renderVirtual

  return {
    name: 'nuxt:stable-entry',
    configResolved (config) {
      sourcemap = !!config.build.sourcemap
    },
    apply: () => true,
    configEnvironment (name, config) {
      if (name !== 'client') { return }
      const modulePreload = config.build?.modulePreload
      const resolveDependencies = typeof modulePreload === 'object' ? modulePreload.resolveDependencies : undefined
      if (modulePreload !== false) {
        config.build ||= {}
        config.build.modulePreload = {
          ...typeof modulePreload === 'object' ? modulePreload : {},
          resolveDependencies: (filename, deps, context) => {
            const resolvedDeps = resolveDependencies ? resolveDependencies(filename, deps, context) : deps
            return resolvedDeps.filter(dep => !isStablePreloadDependency(dep, stablePreloadFiles))
          },
        }
      }
      return {
        build: {
          rolldownOptions: {
            output: {
              codeSplitting: {
                groups: [
                  {
                    name: (id: string) => {
                      const path = normalizeVirtualId(id)
                      if (path === routesPath) { return 'routes' }
                      if (path === layoutsPath) { return 'layouts' }
                      return null
                    },
                    priority: 100,
                  },
                ],
              },
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
      // only apply plugin if any relevant output filename pattern is hashed
      return toArray(environment.config.build.rolldownOptions?.output)
        .some(output => [output?.entryFileNames, output?.chunkFileNames].some(pattern => typeof pattern === 'string' && pattern.includes('[hash]')))
    },
    renderChunk (code, chunk, _options, meta) {
      const targets: Array<{ alias: string, fileName: string }> = []
      for (const { alias, chunkName } of aliases) {
        const target = Object.values(meta.chunks).find(c => c.name === chunkName)
        if (!target || target.fileName === chunk.fileName) { continue }
        if (!chunk.imports.includes(target.fileName) && !chunk.dynamicImports.includes(target.fileName)) { continue }
        targets.push({ alias, fileName: target.fileName })
      }
      if (targets.length === 0) {
        return
      }

      const s = new MagicString(code)
      for (const { alias, fileName } of targets) {
        const specifier = relative(dirname(chunk.fileName), fileName)
        const normalisedSpecifier = specifier.startsWith('.') ? specifier : `./${specifier}`
        const filename = new RegExp(`(?<=['"])${escapeStringRegexp(normalisedSpecifier)}`, 'g')
        s.replaceAll(filename, alias)
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: sourcemap ? s.generateMap({ hires: true }) : undefined,
        }
      }
    },
    generateBundle: {
      order: 'pre',
      handler (_options, bundle) {
        stablePreloadFiles.clear()
        for (const { chunkName } of aliases) {
          if (chunkName === 'entry') { continue }
          const target = Object.values(bundle).find(c => c.type === 'chunk' && c.name === chunkName)
          if (target?.type === 'chunk') {
            stablePreloadFiles.add(target.fileName)
            stablePreloadFiles.add(basename(target.fileName))
          }
        }
      },
    },
    writeBundle (_options, bundle) {
      const prefix = withoutLeadingSlash(nuxt.options.app.buildAssetsDir)
      for (const { chunkName, exportName } of aliases) {
        let file = Object.values(bundle).find(c => c.type === 'chunk' && c.name === chunkName)?.fileName
        if (file?.startsWith(prefix)) {
          file = file.slice(prefix.length).replace(/^[\\/]+/, '')
        }
        fileNames[exportName] = file
      }
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

const VIRTUAL_PREFIX_RE = /^\0?\/?virtual:nuxt:/
function normalizeVirtualId (id: string) {
  if (VIRTUAL_PREFIX_RE.test(id)) {
    id = decodeURIComponent(id.replace(VIRTUAL_PREFIX_RE, ''))
  }
  return id.replace(/\?.*$/, '')
}

function isStablePreloadDependency (dep: string, aliases: Set<string>) {
  return aliases.has(dep) || aliases.has(dep.replace(/^\.\//, '')) || aliases.has(basename(dep))
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
