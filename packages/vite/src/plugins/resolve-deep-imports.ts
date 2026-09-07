import { resolveModulePath } from 'exsolve'
import { normalize, resolve } from 'pathe'
import type { Environment, Plugin } from 'vite'
import { directoryToURL, logger, resolveAlias } from '@nuxt/kit'
import { parseNodeModulePath } from '@nuxt/kit/internal'
import escapeRE from 'escape-string-regexp'
import type { Nuxt } from '@nuxt/schema'

const VIRTUAL_RE = /^\0?virtual:(?:nuxt:)?/
const ABSOLUTE_RE = /^(?:[/\\](?![/\\])|[/\\]{2}(?!\.)|[A-Z]:[/\\])/i
const ABSOLUTE_OR_VIRTUAL_RE = /^(?:[/\\](?![/\\])|[/\\]{2}(?!\.)|[A-Za-z]:[/\\]|\0?virtual:)/
const HTML_RE = /\.html(?:$|\?)/

export function ResolveDeepImportsPlugin (nuxt: Nuxt): Plugin {
  const exclude: string[] = ['virtual:', '\0virtual:', '/__skip_vite', '@vitest/']
  const EXCLUDE_RE = new RegExp('^(?:' + exclude.map(e => escapeRE(e)).join('|') + ')')

  const conditions: Record<string, undefined | string[]> = {}

  function resolveConditions (environment: Environment) {
    const resolvedConditions = new Set([nuxt.options.dev ? 'development' : 'production', ...environment.config.resolve.conditions])
    if (resolvedConditions.has('browser')) {
      resolvedConditions.add('web')
      resolvedConditions.add('import')
      resolvedConditions.add('module')
      resolvedConditions.add('default')
    }
    if (environment.config.mode === 'test') {
      resolvedConditions.add('import')
      resolvedConditions.add('require')
    }
    return [...resolvedConditions]
  }

  return {
    name: 'nuxt:resolve-bare-imports',
    enforce: 'post',
    resolveId: {
      filter: {
        id: {
          exclude: [ABSOLUTE_RE, EXCLUDE_RE],
        },
      },
      async handler (id, importer, options) {
        // Vite probes `index.html` as a fallback entry when no input is configured; it is not a bare import
        if (options.isEntry && HTML_RE.test(id)) {
          return
        }

        if (!importer || !ABSOLUTE_OR_VIRTUAL_RE.test(importer)) {
          return
        }

        const normalisedId = resolveAlias(normalize(id), nuxt.options.alias)
        const isNuxtTemplate = importer.startsWith('virtual:nuxt')
        const normalisedImporter = (isNuxtTemplate ? decodeURIComponent(importer) : importer).replace(VIRTUAL_RE, '')

        if (nuxt.options.experimental.templateImportResolution !== false && isNuxtTemplate) {
          const template = nuxt.options.build.templates.find(t => resolve(nuxt.options.buildDir, t.filename!) === normalisedImporter)
          if (template?._path) {
            const res = await this.resolve?.(normalisedId, template._path, { skipSelf: true })
            if (res !== undefined && res !== null) {
              return res
            }
          }
        }

        const dir = parseNodeModulePath(normalisedImporter).dir || nuxt.options.appDir

        const res = await this.resolve?.(normalisedId, dir, { skipSelf: true })
        if (res !== undefined && res !== null) {
          return res
        }

        const environmentConditions = conditions[this.environment.name] ||= resolveConditions(this.environment)

        const path = resolveModulePath(id, {
          from: [dir, ...nuxt.options.modulesDir].map(d => directoryToURL(d)),
          suffixes: ['', 'index'],
          conditions: environmentConditions,
          try: true,
        })

        if (!path) {
          logger.debug('Could not resolve id', id, importer)
          return null
        }

        return normalize(path)
      },
    },
  }
}
