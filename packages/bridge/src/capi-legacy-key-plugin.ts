import crypto from 'crypto'
import { pathToFileURL } from 'url'
import { createUnplugin } from 'unplugin'
import { parse } from 'acorn'
import MagicString from 'magic-string'
import { walk } from 'estree-walker'
import { parseQuery, parseURL } from 'ufo'

function createKey (
  source: string,
  method: crypto.BinaryToTextEncoding = 'base64'
) {
  const hash = crypto.createHash('md5')
  hash.update(source)
  return hash.digest(method).toString()
}

const keyedFunctions =
  /(useStatic|shallowSsrRef|ssrPromise|ssrRef|reqSsrRef|useAsync)/

export const KeyPlugin = createUnplugin(() => {
  return {
    name: 'nuxt-legacy-capi-key-transform',
    enforce: 'pre',
    transformInclude (id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      const query = parseQuery(search)

      if (id.includes('node_modules')) {
        return false
      }

      // vue files
      if (pathname.endsWith('.vue') && (query.type === 'script' || !search)) {
        return true
      }

      // js files
      if (pathname.match(/\.((c|m)?j|t)sx?/g)) {
        return true
      }
    },
    transform (code, id) {
      if (!keyedFunctions.test(code)) { return null }

      try {
        const { 0: script = code, index: codeIndex = 0 } =
          code.match(/(?<=<script[^>]*>)[\S\s.]*?(?=<\/script>)/) || []
        const ast = parse(script, { ecmaVersion: 2020, sourceType: 'module' })
        const s = new MagicString(code)

        walk(ast, {
          enter (node) {
            const { end } = node as unknown as {
              end: number
            }
            const { callee, arguments: args = [] } = node as {
              callee?: {
                type?: string
                name?: string
                property?: { type: string; name: string }
              }
              arguments?: any[]
            }
            if (
              callee?.type === 'Identifier' ||
              callee?.property?.type === 'Identifier'
            ) {
              let method: crypto.BinaryToTextEncoding = 'base64'

              switch (callee.name || callee.property?.name) {
                case 'useStatic':
                  if (args.length > 2) { return }
                  if (args.length === 2) {
                    s.prependLeft(codeIndex + end - 1, ', undefined')
                  }
                  method = 'hex'
                  break

                case 'shallowSsrRef':
                case 'ssrPromise':
                case 'ssrRef':
                case 'reqSsrRef':
                case 'useAsync':
                  if (args.length > 1) { return }
                  break

                default:
                  return
              }
              s.appendLeft(
                codeIndex + end - 1,
                ", '" + createKey(`${id}-${end}`, method) + "'"
              )
            }
          }
        })

        return s.toString()
      } catch { }
    }
  }
})
