import { addVitePlugin } from '@nuxt/kit'
import { isNuxtPrepare, onigiriIslands, projectSuffix, withMatrix } from '../../matrix.ts'

const TEMPLATE_RE = /<template[^>]*>[\s\S]*<\/template>/
// `nuxt-client`, `nuxt-client="expr"` or `:nuxt-client="expr"` inside an opening tag
const NUXT_CLIENT_ATTR_RE = /(<[A-Za-z][^>]*?\s):?nuxt-client(="[^"]*")?(?=[\s/>])/g

export default withMatrix({
  css: ['~/global.css'],
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  modules: [
    (_options, nuxt) => {
      if (nuxt.options.experimental.componentIslands !== 'vue-onigiri') { return }
      
      // small plugin to rewtite `nuxt-client` to `v-load-client`
      addVitePlugin({
        name: 'fixture:nuxt-client-to-v-load-client',
        enforce: 'pre',
        transform: {
          filter: { id: /\.vue$/, code: /nuxt-client/ },
          handler (code) {
            const template = code.match(TEMPLATE_RE)
            if (!template) { return }
            const rewritten = template[0].replace(NUXT_CLIENT_ATTR_RE, (_, tag, value = '') => `${tag}v-load-client${value}`)
            return rewritten === template[0] ? undefined : code.replace(template[0], rewritten)
          },
        },
      }, { prepend: true })
    },
  ],
  experimental: {
    componentIslands: onigiriIslands ? 'vue-onigiri' : { selectiveClient: 'deep' },
    runtimeBaseURL: true,
  },
  nitro: {
    prerender: {
      routes: [
        '/prefetch/server-components',
        '/prerender/island-a',
        '/prerender/island-b',
      ],
    },
  },
})
