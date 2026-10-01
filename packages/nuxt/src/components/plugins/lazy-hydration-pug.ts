import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { camelCase, pascalCase } from 'scule'
import { directoryToURL, tryImportModule, tryResolveModule } from '@nuxt/kit'
import { componentDiagnostics } from '@nuxt/kit/internal'
import type { ScopeTracker } from 'oxc-walker'
import { linkToAlias, offsetToPosition } from '../../utils.ts'

import type { RolldownString } from 'rolldown-string'
import type { Nuxt } from '@nuxt/schema'

interface PugToken {
  type: string
  val?: unknown
  name?: string
  loc: {
    start: {
      line: number
      column: number
    }
  }
}

type PugLexer = (src: string, options?: {
  filename?: string
  startingLine?: number
  startingColumn?: number
}) => PugToken[]

type PugLexerPromise = Promise<PugLexer | null>

let pugLexerPromise: PugLexerPromise | undefined

function loadPugLexer (rootDir: string) {
  return pugLexerPromise ??= resolvePugLexer(rootDir)
}

async function resolvePugLexer (rootDir: string): PugLexerPromise {
  try {
    const pugPath = await tryResolveModule('pug', [directoryToURL(rootDir)])
    if (!pugPath) { return null }
    return (await tryImportModule<PugLexer>('pug-lexer', { url: [pathToFileURL(pugPath)] })) ?? null
  } catch {
    pugLexerPromise = undefined
    return null
  }
}

export async function transformPugTemplate (params: {
  code: string
  template: string
  offset: number
  s: RolldownString
  components: Set<string>
  scopeTracker: ScopeTracker
  strategies: Record<string, string>
  id: string
  nuxt: Nuxt | null
}) {
  const { code, template, offset, s, components, scopeTracker, strategies, id, nuxt } = params
  const lex = await loadPugLexer(nuxt?.options.rootDir ?? process.cwd())
  if (!lex) { return }

  const bodyStart = template.indexOf('>') + 1
  const { line, column } = offsetToPosition(code, offset + bodyStart)

  const tokens = lex(template.slice(bodyStart), {
    filename: id,
    startingLine: line,
    startingColumn: column,
  })

  const lineStarts = [0]
  for (let i = 0; i < code.length; i++) {
    if (code.charCodeAt(i) === 10) { lineStarts.push(i + 1) }
  }

  let name: string | undefined
  let start = 0
  let pascalName = ''
  let strategy: string | undefined

  for (const token of tokens) {
    if (token.type === 'tag') {
      name = typeof token.val === 'string' ? token.val : undefined
      start = (lineStarts[token.loc.start.line - 1] ?? 0) + token.loc.start.column - 1
      pascalName = name ? pascalCase(name.replace(/^(?:Lazy|lazy-)/, '')) : ''
      strategy = undefined
      if (!name || !components.has(pascalName) || scopeTracker.getDeclaration(name)) { name = undefined }
      continue
    }
    if (token.type === 'eos' || token.type === 'mixin' || token.type === 'call') {
      name = undefined
      continue
    }
    if (!name || token.type !== 'attribute' || !token.name) { continue }

    const prop = camelCase(token.name.replace(/^(?:v-bind:|:)/, ''))
    if (!(prop in strategies)) { continue }

    if (strategy) {
      componentDiagnostics.NUXT_B3005({ component: name, file: linkToAlias(id, nuxt, offsetToPosition(code, start)) })
      continue
    }
    strategy = strategies[prop]

    if (!/^(?:Lazy|lazy-)/.test(name)) {
      if (nuxt?.options.dev || nuxt?.options.test) {
        const relativePath = linkToAlias(id, nuxt, offsetToPosition(code, start))
        componentDiagnostics.NUXT_B3006({ component: name, file: relativePath, lazyName: `Lazy${pascalName}` })
      }
      continue
    }

    s.overwrite(start, start + name.length, 'Lazy' + strategy + pascalName)
  }
}
