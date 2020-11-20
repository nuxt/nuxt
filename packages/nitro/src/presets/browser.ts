import { writeFile } from 'fs-extra'
import { resolve } from 'upath'
import consola from 'consola'
import { extendPreset, prettyPath } from '../utils'
import { SigmaPreset, SigmaContext, SigmaInput } from '../context'
import { worker } from './worker'

export const browser: SigmaPreset = extendPreset(worker, (input: SigmaInput) => {
  const routerBase = input._nuxt.routerBase

  const script = `<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('${routerBase}sw.js');
  });
}
</script>`

  // TEMP FIX
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="prefetch" href="${routerBase}sw.js">
  <link rel="prefetch" href="${routerBase}_server/index.js">
  <script>
  async function register () {
    const registration = await navigator.serviceWorker.register('${routerBase}sw.js')
    await navigator.serviceWorker.ready
    registration.active.addEventListener('statechange', (event) => {
      if (event.target.state === 'activated') {
        window.location.reload()
      }
    })
  }
  if (location.hostname !== 'localhost' && location.protocol === 'http:') {
    location.replace(location.href.replace('http://', 'https://'))
  } else {
    register()
  }
  </script>
</head>

<body>
  Loading...
</body>

</html>`

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
        await writeFile(resolve(output.publicDir, 'sw.js'), `self.importScripts('${input._nuxt.routerBase}_server/index.js');`)

        // Temp fix
        await writeFile(resolve(output.publicDir, 'index.html'), html)
        await writeFile(resolve(output.publicDir, '200.html'), html)
        await writeFile(resolve(output.publicDir, '404.html'), html)

        consola.info('Ready to deploy to static hosting:', prettyPath(output.publicDir as string))
      }
    }
  }
})
