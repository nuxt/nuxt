import { resolve, relative } from 'path'
import { existsSync, copy } from 'fs-extra'
import consola from 'consola'
import { extendTarget } from '../utils'
import { SLSTarget } from '../config'
import { worker } from './worker'

export const browser: SLSTarget = extendTarget(worker, (options) => {
  const script = `<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('${options.routerBase}_nuxt.js');
  });
}
</script>`.replace(/\n| +/g, '')

  return {
    targetDir: '{{ publicDir }}',
    nuxtHooks: {
      'vue-renderer:ssr:templateParams' (params) {
        params.APP += script
      },
      'vue-renderer:spa:templateParams' (params) {
        params.APP += script
      }
    },
    hooks: {
      'template:document' (tmpl) {
        tmpl.compiled = tmpl.compiled.replace('</body>', script + '</body>')
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
  }
})
