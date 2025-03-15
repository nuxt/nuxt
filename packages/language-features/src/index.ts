import { replaceAll, toString } from 'muggle-string'
import type { VueLanguagePlugin } from '@vue/language-core'
import { augmentVlsCtx } from './utils/augment-vls-ctx'

const plugin: VueLanguagePlugin = () => {
  const vlsCtxRouteRe = /\b__VLS_ctx.\$route\b/g

  return {
    version: 2.1,
    resolveEmbeddedCode (fileName, sfc, embeddedFile) {
      // TODO: do we want to apply this to *every* .vue file or only the Nuxt ones that the user wrote themselves?
      if (embeddedFile.id.startsWith('script_')) {
        const typedUseRoute = `useRoute<import('#app').GetRouteNameByPath<'${fileName}'>>`

        // replace `useRoute()` calls with typed version
        replaceAll(
          embeddedFile.content,
          // eslint-disable-next-line prefer-regex-literals
          new RegExp('useRoute\\(\\)', 'g'),
          `${typedUseRoute}()`,
        )

        const contentStr = toString(embeddedFile.content)

        // augment __VLS_ctx.$route to override $route in template blocks
        if (contentStr.match(vlsCtxRouteRe)) {
          augmentVlsCtx(embeddedFile.content, () => ` & {
  $route: ReturnType<typeof ${typedUseRoute}>();
}`)
        }
      }
    },
  }
}

export default plugin
