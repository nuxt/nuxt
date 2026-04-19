import { ViteNodeRunner } from 'vite-node/client'

import { consola } from 'consola'
import { viteNodeFetch, viteNodeOptions } from '#vite-node'
import process from 'node:process'

const runner: ViteNodeRunner = createRunner()

function createRunner () {
  return new ViteNodeRunner({
    root: viteNodeOptions.root, // Equals to Nuxt `srcDir`
    base: viteNodeOptions.base,
    resolveId (id, importer) {
      return viteNodeFetch.resolveId(id, importer)
    },
    fetchModule (id) {
      id = id.replace(/\/\//g, '/') // TODO: fix in vite-node
      return viteNodeFetch.fetchModule(id).catch((err) => {
        const errorData = err?.data
        if (!errorData) {
          throw err
        }
        let built: Error
        try {
          built = buildViteError(errorData, id)
        } catch (buildErr) {
          consola.warn('Internal nuxt error while formatting vite-node error. Please report this!', buildErr)
          const message = `[vite-node] [TransformError] ${errorData?.message || '-'}`
          consola.error(message, errorData)
          built = Object.assign(new Error(message), {
            statusText: 'Vite Error',
            statusMessage: 'Vite Error',
            stack: `${message}\nat ${id}\n` + (errorData?.stack || ''),
          })
        }
        throw built
      })
    },
  })
}

function buildViteError (errorData: any, id: string): Error {
  const loc = (errorData.id || id || '').replace(process.cwd(), '.')

  // `err.message` from some compilers (notably @vue/compiler-sfc) embeds a
  // `[scope/plugin]` prefix plus a code frame, separated from the real
  // description by a blank line. Split on that boundary so we can show the
  // clean one-liner as the heading and feed the frame text to `hint` below.
  const rawMessage: string = errorData.message || ''
  const [headRaw, ...frameTail] = rawMessage.split(/\r?\n\s*\n/)
  const reason = ((headRaw || '').split(/\r?\n/)[0] ?? '')
    .replace(/^\[@?[\w.\-/:]+\]\s*/, '')
    .trim()
  const messageFrame = frameTail.length ? frameTail.join('\n\n').trim() : ''

  const message = reason ? `${loc} — ${reason}` : (rawMessage || loc)

  const error = Object.assign(new Error(message), {
    name: 'ViteError',
    statusText: 'Vite Error',
    statusMessage: 'Vite Error',
    code: errorData.code,
    // Youch renders `hint` as a styled callout alongside the main message —
    // a natural home for the code frame.
    hint: errorData.frame || messageFrame || undefined,
  })

  // Prefer the server-side stack so Youch's stack viewer points at the real
  // origin (compiler-sfc → plugin-vue → Vite) rather than this runner.
  if (errorData.stack) {
    error.stack = errorData.stack
  }

  return error
}

export default runner
