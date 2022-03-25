import { pathToFileURL } from 'url'
import MagicString from 'magic-string'
import { findStaticImports } from 'mlly'
import { parseQuery, parseURL } from 'ufo'
import { createUnplugin } from 'unplugin'

export const VueCompat = createUnplugin((opts: { src?: string }) => {
  return {
    name: 'nuxt-legacy-vue-transform',
    enforce: 'post',
    transformInclude (id) {
      if (id.includes('vue2-bridge')) { return false }

      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      const query = parseQuery(search)

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
      if (id.includes('vue2-bridge')) { return }

      const s = new MagicString(code)
      const imports = findStaticImports(code).filter(i => i.type === 'static' && vueAliases.includes(i.specifier))

      for (const i of imports) {
        s.overwrite(i.start, i.end, i.code.replace(`"${i.specifier}"`, `"${opts.src}"`).replace(`'${i.specifier}'`, `'${opts.src}'`))
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: s.generateMap({ source: id, includeContent: true })
        }
      }
    }
  }
})

const vueAliases = [
  // vue
  'vue',
  // vue 3 helper packages
  '@vue/shared',
  '@vue/reactivity',
  '@vue/runtime-core',
  '@vue/runtime-dom',
  // vue-demi
  'vue-demi',
  ...[
    // vue 2 dist files
    'vue/dist/vue.common.dev',
    'vue/dist/vue.common',
    'vue/dist/vue.common.prod',
    'vue/dist/vue.esm.browser',
    'vue/dist/vue.esm.browser.min',
    'vue/dist/vue.esm',
    'vue/dist/vue',
    'vue/dist/vue.min',
    'vue/dist/vue.runtime.common.dev',
    'vue/dist/vue.runtime.common',
    'vue/dist/vue.runtime.common.prod',
    'vue/dist/vue.runtime.esm',
    'vue/dist/vue.runtime',
    'vue/dist/vue.runtime.min'
  ].flatMap(m => [m, `${m}.js`])
]
