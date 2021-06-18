import fs from 'fs'
import { defineNuxtModule, resolveAlias } from '@nuxt/kit'
import { resolve, dirname } from 'upath'
import { scanComponents } from './scan'
import type { ComponentsDir } from './types'

const isPureObjectOrString = (val: any) => (!Array.isArray(val) && typeof val === 'object') || typeof val === 'string'
const getDir = (p: string) => fs.statSync(p).isDirectory() ? p : dirname(p)

export default defineNuxtModule({
  name: 'components',
  defaults: {
    dirs: ['~/components']
  },
  setup (options, nuxt) {
    let componentDirs = []

    // Resolve dirs
    nuxt.hook('app:resolve', async () => {
      await nuxt.callHook('components:dirs', options.dirs)

      componentDirs = options.dirs.filter(isPureObjectOrString).map((dir) => {
        const dirOptions: ComponentsDir = typeof dir === 'object' ? dir : { path: dir }
        const dirPath = getDir(resolveAlias(dirOptions.path, nuxt.options.alias))
        const transpile = typeof dirOptions.transpile === 'boolean' ? dirOptions.transpile : 'auto'
        const extensions = dirOptions.extensions || ['vue'] // TODO: nuxt extensions and strip leading dot

        dirOptions.level = Number(dirOptions.level || 0)

        const enabled = fs.existsSync(dirPath)
        if (!enabled && dirOptions.path !== '~/components') {
          // eslint-disable-next-line no-console
          console.warn('Components directory not found: `' + dirPath + '`')
        }

        return {
          ...dirOptions,
          enabled,
          path: dirPath,
          extensions,
          pattern: dirOptions.pattern || `**/*.{${extensions.join(',')},}`,
          ignore: [
            '**/*.stories.{js,ts,jsx,tsx}', // ignore storybook files
            '**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}', // ignore mixins
            '**/*.d.ts', // .d.ts files
            // TODO: support nuxt ignore patterns
            ...(dirOptions.ignore || [])
          ],
          transpile: (transpile === 'auto' ? dirPath.includes('node_modules') : transpile)
        }
      }).filter(d => d.enabled)

      nuxt.options.build!.transpile!.push(...componentDirs.filter(dir => dir.transpile).map(dir => dir.path))
    })

    // Scan components and add to plugin
    nuxt.hook('app:templates', async (app) => {
      const components = await scanComponents(componentDirs, nuxt.options.srcDir!)
      await nuxt.callHook('components:extend', components)
      if (!components.length) {
        return
      }

      app.templates.push({
        path: 'components.mjs',
        src: resolve(__dirname, 'runtime/components.tmpl.mjs'),
        data: { components }
      })
      app.templates.push({
        path: 'components.d.ts',
        src: resolve(__dirname, 'runtime/components.tmpl.d.ts'),
        data: { components }
      })
      app.plugins.push({ src: '#build/components' })
    })

    // Watch for changes
    nuxt.hook('builder:watch', async (event, path) => {
      if (!['add', 'unlink'].includes(event)) {
        return
      }
      const fPath = resolve(nuxt.options.rootDir, path)
      if (componentDirs.find(dir => fPath.startsWith(dir.path))) {
        await nuxt.callHook('builder:generateApp')
      }
    })
  }
})
