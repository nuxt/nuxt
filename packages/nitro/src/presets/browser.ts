import { existsSync, promises as fsp } from 'fs'
import { resolve } from 'pathe'
import consola from 'consola'
import { joinURL } from 'ufo'
import { extendPreset, prettyPath } from '../utils'
import { NitroPreset, NitroContext, NitroInput } from '../context'
import { worker } from './worker'

export const browser: NitroPreset = extendPreset(worker, (input: NitroInput) => {
  // TODO: Join base at runtime
  const baseURL = input._nuxt.baseURL

  const script = `<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('${joinURL(baseURL, 'sw.js')}');
  });
}
</script>`

  // TEMP FIX
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="prefetch" href="${joinURL(baseURL, 'sw.js')}">
  <link rel="prefetch" href="${joinURL(baseURL, '_server/index.mjs')}">
  <script>
  async function register () {
    const registration = await navigator.serviceWorker.register('${joinURL(baseURL, 'sw.js')}')
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

  return <NitroInput> {
    entry: '{{ _internal.runtimeDir }}/entries/service-worker',
    output: {
      serverDir: '{{ output.dir }}/public/_server'
    },
    nuxtHooks: {
      'generate:page' (page) {
        page.html = page.html.replace('</body>', script + '</body>')
      }
    },
    hooks: {
      'nitro:document' (tmpl) {
        tmpl.contents = tmpl.contents.replace('</body>', script + '</body>')
      },
      async 'nitro:compiled' ({ output }: NitroContext) {
        await fsp.writeFile(resolve(output.publicDir, 'sw.js'), `self.importScripts('${joinURL(baseURL, '_server/index.mjs')}');`, 'utf8')

        // Temp fix
        if (!existsSync(resolve(output.publicDir, 'index.html'))) {
          await fsp.writeFile(resolve(output.publicDir, 'index.html'), html, 'utf8')
        }
        if (!existsSync(resolve(output.publicDir, '200.html'))) {
          await fsp.writeFile(resolve(output.publicDir, '200.html'), html, 'utf8')
        }
        if (!existsSync(resolve(output.publicDir, '404.html'))) {
          await fsp.writeFile(resolve(output.publicDir, '404.html'), html, 'utf8')
        }
        consola.info('Ready to deploy to static hosting:', prettyPath(output.publicDir as string))
      }
    }
  }
})
