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
</script>`.replace(/\n|  +/g, '')

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
      async done ({ rootDir, publicDir }) {
        const fallback200 = resolve(publicDir, '200.html')
        const fallback400 = resolve(publicDir, '400.html')
        if (!existsSync(fallback400) && existsSync(fallback200)) {
          await copy(fallback200, fallback400)
        }
        consola.info(`Try with \`nuxt start ${relative(process.cwd(), rootDir)}\``)
      }
    }
  }
})
