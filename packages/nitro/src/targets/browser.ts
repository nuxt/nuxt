import { resolve, relative } from 'path'
import { existsSync, copy } from 'fs-extra'
import consola from 'consola'
import { extendTarget } from '../utils'
import { SLSTarget } from '../config'
import { worker } from './worker'

const getScriptTag = () => `<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/server.js');
  });
}
</script>`.replace(/\n| +/g, '')

export const browser: SLSTarget = extendTarget(worker, {
  targetDir: ({ publicDir }) => publicDir,
  nuxtHooks: {
    'vue-renderer:ssr:templateParams' (params) {
      params.APP += getScriptTag()
    },
    'vue-renderer:spa:templateParams' (params) {
      params.APP += getScriptTag()
    }
  },
  hooks: {
    'template:document' (tmpl) {
      tmpl.compiled = tmpl.compiled.replace('</body>', getScriptTag() + '</body>')
    },
    async done ({ targetDir, publicDir }) {
      const rootIndex = resolve(publicDir, 'index.html')
      const rootFallback = resolve(publicDir, '200.html')
      if (!existsSync(rootIndex) && existsSync(rootFallback)) {
        await copy(rootFallback, rootIndex)
      }

      consola.info(`Try with \`npx serve ${relative(process.cwd(), targetDir)}\``)
    }
  }
})
