import { promises as fsp } from 'node:fs'
import { join, resolve } from 'pathe'
import { createApp, eventHandler, lazyEventHandler, toNodeListener } from 'h3'
import { listen } from 'listhen'
import type { NuxtAnalyzeMeta } from '@nuxt/schema'
import { loadKit } from '../utils/kit'
import { clearDir } from '../utils/fs'
import { overrideEnv } from '../utils/env'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'analyze',
    usage: 'npx nuxi analyze [--log-level] [--name] [--no-serve] [rootDir]',
    description: 'Build nuxt and analyze production bundle (experimental)'
  },
  async invoke (args) {
    overrideEnv('production')

    const name = args.name || 'default'
    const slug = name.trim().replace(/[^a-z0-9_-]/gi, '_')
    const rootDir = resolve(args._[0] || '.')

    let analyzeDir = join(rootDir, '.nuxt/analyze', slug)
    let buildDir = join(analyzeDir, '.nuxt')
    let outDir = join(analyzeDir, '.output')

    const startTime = Date.now()

    const { loadNuxt, buildNuxt } = await loadKit(rootDir)

    const nuxt = await loadNuxt({
      rootDir,
      overrides: {
        build: {
          analyze: true
        },
        analyzeDir,
        buildDir,
        nitro: {
          output: {
            dir: outDir
          }
        },
        logLevel: args['log-level']
      }
    })

    analyzeDir = nuxt.options.analyzeDir
    buildDir = nuxt.options.buildDir
    outDir = nuxt.options.nitro.output?.dir || outDir

    await clearDir(analyzeDir)
    await buildNuxt(nuxt)

    const endTime = Date.now()

    const meta: NuxtAnalyzeMeta = {
      name,
      slug,
      startTime,
      endTime,
      analyzeDir,
      buildDir,
      outDir
    }

    await nuxt.callHook('build:analyze:done', meta)
    await fsp.writeFile(join(analyzeDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8')

    console.info('Analyze results are available at: `' + analyzeDir + '`')
    console.warn('Do not deploy analyze results! Use `nuxi build` before deploying.')

    if (args.serve !== false && !process.env.CI) {
      const app = createApp()

      const serveFile = (filePath: string) => lazyEventHandler(async () => {
        const contents = await fsp.readFile(filePath, 'utf-8')
        return eventHandler((event) => { event.node.res.end(contents) })
      })

      console.info('Starting stats server...')

      app.use('/client', serveFile(join(analyzeDir, 'client.html')))
      app.use('/nitro', serveFile(join(analyzeDir, 'nitro.html')))
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
  }
})
