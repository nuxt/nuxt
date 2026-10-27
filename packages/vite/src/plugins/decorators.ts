import type { Plugin } from 'vite'
import type { SourceMapInput } from 'rollup'
import { ensureDependencyInstalled, getAddDependencyCommand } from '@nuxt/kit'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import type { Nuxt } from '@nuxt/schema'
import jsTokens from 'js-tokens'
import { JS_ID_RE, VUE_NON_SCRIPT_BLOCK_RE, VUE_SCRIPT_ID_FILTER } from '../utils/index.ts'

const BABEL_DECORATOR_DEPS = ['@babel/plugin-proposal-decorators', '@babel/plugin-syntax-jsx'] as const

// A decorator `@` is followed by code, so a `@` is dropped only when the text after
// it cannot continue a decorator. This holds whether or not the `@` is in a comment,
// string or regex, and keeps `/*@__PURE__*/`, scoped package names and most JSDoc
// tags away from `hasDecoratorSyntax`.
const NOT_COMMENT = String.raw`\/(?![*/])`
// ASCII that cannot follow `@x`, start a member name after `@x *`, or follow `@x`
// where only a class expression is allowed (after `*`, or a `/` not closing a comment).
const NOT_AFTER_DECORATOR = String.raw`[!%&)+,\-:;<=>?\]^\x60{|}~]`
const NOT_AFTER_STAR = String.raw`[!%&()*+,\-:;<=>?@\]^\x60{|}~]`
const NOT_IN_EXPRESSION = String.raw`[!"#%&')*+,\-:;<=>?[\]^\x60{|}~]`
const EXPRESSION_BEFORE = String.raw`(?<=(?:\*|(?<!\*)\/)[ \t]*)`
const NEVER_DECORATOR = String.raw`[\w$]+\s*(?:${NOT_AFTER_DECORATOR}|$|${NOT_COMMENT}|\*\s*(?:${NOT_AFTER_STAR}|$|${NOT_COMMENT}))`
const NEVER_DECORATOR_IN_EXPRESSION = String.raw`[\w$]+\s*(?:${NOT_IN_EXPRESSION}|$|${NOT_COMMENT}|(?<=\s)(?!class(?![\w$]))[A-Za-z_$])`
const MAY_CONTAIN_DECORATOR_RE = new RegExp(String.raw`(?!${EXPRESSION_BEFORE}@${NEVER_DECORATOR_IN_EXPRESSION})@(?!${NEVER_DECORATOR})`)

export function hasDecoratorSyntax (code: string, jsx = false) {
  const tokens = jsx ? jsTokens(code, { jsx: true }) : jsTokens(code)

  for (const token of tokens) {
    if (!token.value.includes('@')) {
      continue
    }

    switch (token.type) {
      case 'HashbangComment':
      case 'SingleLineComment':
      case 'TemplateHead':
      case 'TemplateMiddle':
        continue
      case 'MultiLineComment':
      case 'StringLiteral':
      case 'NoSubstitutionTemplate':
      case 'TemplateTail':
      case 'JSXString':
        // An unclosed token can consume code that follows it. Let Babel parse
        // ambiguous input instead of potentially hiding a real decorator.
        if (token.closed) {
          continue
        }
    }

    return true
  }

  return false
}

export function DecoratorsPlugin (nuxt: Nuxt): Plugin {
  let transformSync: typeof import('@babel/core').transformSync

  return {
    name: 'nuxt:decorators',
    apply: () => !!nuxt.options.experimental.decorators,
    async applyToEnvironment () {
      const result = await ensureDependencyInstalled([...BABEL_DECORATOR_DEPS], {
        rootDir: nuxt.options.rootDir,
        searchPaths: nuxt.options.modulesDir,
        from: import.meta.url,
      })

      if (result !== true) {
        bundlerDiagnostics.NUXT_B7009({ deps: result.map(d => `\`${d}\``).join(' and '), installCommand: await getAddDependencyCommand(result, nuxt.options.rootDir, { dev: true }) })
        return false
      }

      transformSync = await import('@babel/core').then(r => r.transformSync)
      return true
    },
    transform: {
      filter: {
        code: MAY_CONTAIN_DECORATOR_RE,

        id: {
          include: [...VUE_SCRIPT_ID_FILTER, JS_ID_RE],
          exclude: VUE_NON_SCRIPT_BLOCK_RE,
        },
      },
      handler (code, id) {
        // Skip uncompiled SFC markup (raw .vue files not yet processed by @vitejs/plugin-vue)
        if (id.includes('.vue') && code.trimStart().startsWith('<')) {
          return
        }

        if (!hasDecoratorSyntax(code, /\.[jt]sx(?:$|\?)/.test(id))) {
          return
        }

        const result = transformSync(code, {
          filename: id,
          configFile: false,
          plugins: [
            '@babel/plugin-syntax-jsx',
            ['@babel/plugin-proposal-decorators', { version: '2023-11' }],
          ],
          sourceMaps: true,
        })

        if (result?.code != null) {
          return {
            code: result.code,
            map: result.map as SourceMapInput,
          }
        }
      },
    },
  }
}
