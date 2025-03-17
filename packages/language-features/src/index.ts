import { replaceAll, toString } from 'muggle-string'
import type { VueLanguagePlugin } from '@vue/language-core'
import { augmentVlsCtx } from './utils/augment-vls-ctx'

const plugin: VueLanguagePlugin = () => {
  const re = {
    useRoute: {
      /** Targets the spot between `useRoute` and `()` */
      beforeParentheses: /(?<=useRoute)(\s*)(?=\(\))/g,
      /** Targets the spot right before `useRoute()` */
      before: /(?=useRoute(\s*)\(\))/g,
      /** Targets the spot right after `useRoute()` */
      after: /(?<=useRoute(\s*)\(\))/g,
    },
    $route: {
      /**
       * When using `$route` in a template, it is referred
       * to as `__VLS_ctx.$route` in the virtual file.
       */
      vlsCtx: /\b__VLS_ctx.\$route\b/g,
    },
  }

  return {
    version: 2.1,
    resolveEmbeddedCode (fileName, sfc, embeddedFile) {
      if (!embeddedFile.id.startsWith('script_')) {
        return
      }

      // TODO: Do we want to apply this to EVERY .vue file or only to components that the user wrote themselves?

      const routeNameGetter = `import('#app').GetRouteNameByPath<'${fileName}'>`
      const routeNameGetterGeneric = `<${routeNameGetter}>`
      const typedCall = `useRoute${routeNameGetterGeneric}`

      if (embeddedFile.id.startsWith('script_ts')) {
        // Inserts generic into `useRoute()` calls.
        // We only apply this mutation on <script setup> blocks with lang="ts".
        replaceAll(
          embeddedFile.content,
          re.useRoute.beforeParentheses,
          routeNameGetterGeneric,
        )
      } else if (embeddedFile.id.startsWith('script_js')) {
        // Typecasts `useRoute()` calls.
        // We only apply this mutation on plain JS <script setup> blocks.
        replaceAll(
          embeddedFile.content,
          re.useRoute.before,
          `(`,
        )
        replaceAll(
          embeddedFile.content,
          re.useRoute.after,
          ` as ReturnType<typeof ${typedCall}>)`,
        )
      }

      const contentStr = toString(embeddedFile.content)

      // Augment `__VLS_ctx.$route` to override the typings of `$route` in template blocks
      if (contentStr.match(re.$route.vlsCtx)) {
        augmentVlsCtx(embeddedFile.content, () => ` & {
  $route: ReturnType<typeof ${typedCall}>;
}`)
      }
    },
  }
}

export default plugin
