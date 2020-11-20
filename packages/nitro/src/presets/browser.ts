import { writeFile } from 'fs-extra'
import { resolve } from 'upath'
import consola from 'consola'
import { extendPreset, prettyPath } from '../utils'
import { SigmaPreset, SigmaContext, SigmaInput } from '../context'
import { worker } from './worker'

export const browser: SigmaPreset = extendPreset(worker, (input: SigmaInput) => {
  const script = `<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('${input._nuxt.routerBase}_server/index.js');
  });
}
</script>`

  return <SigmaInput> {
    entry: '{{ _internal.runtimeDir }}/entries/service-worker',
    output: {
      serverDir: '{{ output.dir }}/public/_server'
    },
    nuxtHooks: {
      'vue-renderer:ssr:templateParams' (params) {
        params.APP += script
      },
      'vue-renderer:spa:templateParams' (params) {
        params.APP += script
      }
    },
    hooks: {
      'sigma:template:document' (tmpl) {
        tmpl.compiled = tmpl.compiled.replace('</body>', script + '</body>')
      },
      async 'sigma:compiled' ({ output }: SigmaContext) {
        await writeFile(resolve(output.publicDir, 'sw.js'), 'self.importScripts(\'/server/index.js\');')
        consola.info('Ready to deploy to static hosting:', prettyPath(output.publicDir as string))
      }
    }
  }
})
