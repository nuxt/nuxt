import { type ParsedStaticImport, findStaticImports, parseStaticImport } from 'mlly'
import { parseAndWalk, walk } from 'oxc-walker'
import type { ScanPlugin } from '@nuxt/schema'
import type { ParseResult } from 'oxc-parser'

/**
 * Creates a context object for scan plugins scoped to a specific file being scanned.
 * All plugins scanning this file will share the same context instance.
 */
export function createScanPluginContext (code: string, filePath: string) {
  // create the context for sharing the parse result between plugins
  let parseResult: ParseResult | null = null
  let parsedStaticImports: ParsedStaticImport[] | null = null

  const pluginScanThisContext: ThisParameterType<ScanPlugin['scan']> = {
    walkParsed: (...args) => {
      if (parseResult) {
        const options: Parameters<typeof walk>[1] = typeof args[0] === 'function' ? { enter: args[0] } : args[0]
        walk(parseResult.program, options)
        return parseResult
      }

      parseResult = parseAndWalk.call(null, code, filePath, args[0])
      return parseResult
    },
    getParsedStaticImports: () => {
      if (parsedStaticImports) {
        return parsedStaticImports
      }

      const imports = findStaticImports(code)
      parsedStaticImports = imports.map(i => parseStaticImport(i))
      return parsedStaticImports
    },
  }
  return pluginScanThisContext
}

export function matchWithStringOrRegex (value: string, matcher: string | RegExp) {
  if (typeof matcher === 'string') {
    return value === matcher
  } else if (matcher instanceof RegExp) {
    return matcher.test(value)
  }

  return false
}
