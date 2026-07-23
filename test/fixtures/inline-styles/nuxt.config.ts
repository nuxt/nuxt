import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix'

// Regression for https://github.com/nuxt/nuxt/issues/30435: when every CSS
// module bundled into a chunk's CSS asset has also been inlined as a `<style>`
// tag during SSR, the duplicate stylesheet `<link>` should be dropped.
// Regression for https://github.com/nuxt/nuxt/issues/31558: a regular `.vue`
// child reachable only via a server component should still have its CSS inlined.
// Regression for https://github.com/nuxt/nuxt/issues/35591: when
// vite.css.modules.generateScopedName is a string pattern, the class names in
// the SSR inlined `<style>` tags must match those in the server-rendered markup.
// Regression for https://github.com/nuxt/nuxt/issues/29232: custom style attributes
// like `layout="xs"` should be transformed by Vite plugins for SSR inline styles.
const layoutStylePlugin = () => {
  return {
    name: 'layout-style-plugin',
    enforce: 'pre' as const,
    transform (code, id) {
      if (id.endsWith('.css') && id.includes('layout=')) {
        return `.xs { ${code} }`
      }
    },
  }
}

export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  sourcemap: false,
  nitro: {
    output: {
      dir: `.output-${projectSuffix}`,
    },
  },
  vite: {
    css: {
      modules: {
        // Use a string pattern (not a function) to trigger the hash-mismatch bug
        // described in https://github.com/nuxt/nuxt/issues/35591.
        generateScopedName: '_[hash:base64:8]',
      },
    },
    plugins: [
      layoutStylePlugin(),
    ],
  },
})
