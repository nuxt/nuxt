import { promises as fsp } from 'node:fs'
import { join, resolve } from 'pathe'
import { createApp, eventHandler, lazyEventHandler, toNodeListener } from 'h3'
import { listen } from 'listhen'
import { writeTypes } from '../utils/prepare'
import { loadKit } from '../utils/kit'
import { clearDir } from '../utils/fs'
import { overrideEnv } from '../utils/env'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'analyze',
    usage: 'npx nuxi analyze [rootDir]',
    description: 'Build nuxt and analyze production bundle (experimental)'
  },
  async invoke (args) {
    overrideEnv('production')

    const rootDir = resolve(args._[0] || '.')
    const statsDir = join(rootDir, '.nuxt/stats')

    const { loadNuxt, buildNuxt } = await loadKit(rootDir)

    const nuxt = await loadNuxt({
      rootDir,
      config: {
        build: {
          analyze: true
        }
      }
    })

    await clearDir(nuxt.options.buildDir)
    await writeTypes(nuxt)
    await buildNuxt(nuxt)

    const app = createApp()

    const serveFile = (filePath: string) => lazyEventHandler(async () => {
      const contents = await fsp.readFile(filePath, 'utf-8')
      return eventHandler((event) => { event.res.end(contents) })
    })

    console.warn('Do not deploy analyze results! Use `nuxi build` before deploying.')

    console.info('Starting stats server...')

    app.use('/client', serveFile(join(statsDir, 'client.html')))
    app.use('/nitro', serveFile(join(statsDir, 'nitro.html')))
    app.use(eventHandler(() => `<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <title>Nuxt Bundle Stats (experimental)</title>
    </head>
      <h1>Nuxt Bundle Stats (experimental)</h1>
      <ul>
        <li>
          <a href="/nitro">Nitro server bundle stats</a>
        </li>
        <li>
          <a href="/client">Client bundle stats</a>
        </li>
      </ul>
    </html>
    `))

    await listen(toNodeListener(app))

    return 'wait' as const
  }
})
