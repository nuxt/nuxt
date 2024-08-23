import fs, { statSync } from 'node:fs'
import { join, normalize, relative, resolve } from 'pathe'
import { addPluginTemplate, addTemplate, addTypeTemplate, addVitePlugin, addWebpackPlugin, defineNuxtModule, logger, resolveAlias, updateTemplates } from '@nuxt/kit'
import type { Component, ComponentsDir, ComponentsOptions } from 'nuxt/schema'

import { distDir } from '../dirs'
import { clientFallbackAutoIdPlugin } from './client-fallback-auto-id'
import { componentNamesTemplate, componentsIslandsTemplate, componentsMetadataTemplate, componentsPluginTemplate, componentsTypeTemplate } from './templates'
import { scanComponents } from './scan'
import { loaderPlugin } from './loader'
import { TreeShakeTemplatePlugin } from './tree-shake'
import { componentsChunkPlugin, islandsTransform } from './islandsTransform'
import { createTransformPlugin } from './transform'

const isPureObjectOrString = (val: any) => (!Array.isArray(val) && typeof val === 'object') || typeof val === 'string'
const isDirectory = (p: string) => { try { return statSync(p).isDirectory() } catch { return false } }
function compareDirByPathLength ({ path: pathA }: { path: string }, { path: pathB }: { path: string }) {
  return pathB.split(/[\\/]/).filter(Boolean).length - pathA.split(/[\\/]/).filter(Boolean).length
}

const DEFAULT_COMPONENTS_DIRS_RE = /\/components(?:\/(?:global|islands))?$/

export type getComponentsT = (mode?: 'client' | 'server' | 'all') => Component[]

export default defineNuxtModule<ComponentsOptions>({
  meta: {
    name: 'components',
    configKey: 'components',
  },
  defaults: {
    dirs: [],
  },
  setup (componentOptions, nuxt) {
    let componentDirs: ComponentsDir[] = []
    const context = {
      components: [] as Component[],
    }

    const getComponents: getComponentsT = (mode) => {
      return (mode && mode !== 'all')
        ? context.components.filter(c => c.mode === mode || c.mode === 'all' || (c.mode === 'server' && !context.components.some(otherComponent => otherComponent.mode !== 'server' && otherComponent.pascalName === c.pascalName)))
        : context.components
    }

    const normalizeDirs = (dir: any, cwd: string, options?: { priority?: number }): ComponentsDir[] => {
      if (Array.isArray(dir)) {
        return dir.map(dir => normalizeDirs(dir, cwd, options)).flat().sort(compareDirByPathLength)
      }
      if (dir === true || dir === undefined) {
        return [
          { priority: options?.priority || 0, path: resolve(cwd, 'components/islands'), island: true },
          { priority: options?.priority || 0, path: resolve(cwd, 'components/global'), global: true },
          { priority: options?.priority || 0, path: resolve(cwd, 'components') },
        ]
      }
      if (typeof dir === 'string') {
        return [
          { priority: options?.priority || 0, path: resolve(cwd, resolveAlias(dir)) },
        ]
      }
      if (!dir) {
        return []
      }
      const dirs: ComponentsDir[] = (dir.dirs || [dir]).map((dir: any): ComponentsDir => typeof dir === 'string' ? { path: dir } : dir).filter((_dir: ComponentsDir) => _dir.path)
      return dirs.map(_dir => ({
        priority: options?.priority || 0,
        ..._dir,
        path: resolve(cwd, resolveAlias(_dir.path)),
      }))
    }

    // Resolve dirs
    nuxt.hook('app:resolve', async () => {
      // components/ dirs from all layers
      const allDirs = nuxt.options._layers
        .map(layer => normalizeDirs(layer.config.components, layer.config.srcDir, { priority: layer.config.srcDir === nuxt.options.srcDir ? 1 : 0 }))
        .flat()

      await nuxt.callHook('components:dirs', allDirs)

      componentDirs = allDirs.filter(isPureObjectOrString).map((dir) => {
        const dirOptions: ComponentsDir = typeof dir === 'object' ? dir : { path: dir }
        const dirPath = resolveAlias(dirOptions.path)
        const transpile = typeof dirOptions.transpile === 'boolean' ? dirOptions.transpile : 'auto'
        const extensions = (dirOptions.extensions || nuxt.options.extensions).map(e => e.replace(/^\./g, ''))

        const present = isDirectory(dirPath)
        if (!present && !DEFAULT_COMPONENTS_DIRS_RE.test(dirOptions.path)) {
          logger.warn('Components directory not found: `' + dirPath + '`')
        }

        return {
          global: componentOptions.global,
          ...dirOptions,
          // TODO: https://github.com/nuxt/framework/pull/251
          enabled: true,
          path: dirPath,
          extensions,
          pattern: dirOptions.pattern || `**/*.{${extensions.join(',')},}`,
          ignore: [
            '**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}', // ignore mixins
            '**/*.d.{cts,mts,ts}', // .d.ts files
            ...(dirOptions.ignore || []),
          ],
          transpile: (transpile === 'auto' ? dirPath.includes('node_modules') : transpile),
        }
      }).filter(d => d.enabled)

      componentDirs = [
        ...componentDirs.filter(dir => !dir.path.includes('node_modules')),
        ...componentDirs.filter(dir => dir.path.includes('node_modules')),
      ]

      nuxt.options.build!.transpile!.push(...componentDirs.filter(dir => dir.transpile).map(dir => dir.path))
    })

    // components.d.ts
    addTypeTemplate(componentsTypeTemplate)
    // components.plugin.mjs
    addPluginTemplate(componentsPluginTemplate)
    // component-names.mjs
    addTemplate(componentNamesTemplate)
    // components.islands.mjs
    addTemplate({ ...componentsIslandsTemplate, filename: 'components.islands.mjs' })

    if (componentOptions.generateMetadata) {
      addTemplate(componentsMetadataTemplate)
    }

    const unpluginServer = createTransformPlugin(nuxt, getComponents, 'server')
    const unpluginClient = createTransformPlugin(nuxt, getComponents, 'client')

    addVitePlugin(() => unpluginServer.vite(), { server: true, client: false })
    addVitePlugin(() => unpluginClient.vite(), { server: false, client: true })

    addWebpackPlugin(() => unpluginServer.webpack(), { server: true, client: false })
    addWebpackPlugin(() => unpluginClient.webpack(), { server: false, client: true })

    // Do not prefetch global components chunks
    nuxt.hook('build:manifest', (manifest) => {
      const sourceFiles = getComponents().filter(c => c.global).map(c => relative(nuxt.options.srcDir, c.filePath))

      for (const key in manifest) {
        if (manifest[key].isEntry) {
          manifest[key].dynamicImports =
            manifest[key].dynamicImports?.filter(i => !sourceFiles.includes(i))
        }
      }
    })

    // Restart dev server when component directories are added/removed
    nuxt.hook('builder:watch', (event, relativePath) => {
      if (!['addDir', 'unlinkDir'].includes(event)) {
        return
      }

      const path = resolve(nuxt.options.srcDir, relativePath)
      if (componentDirs.some(dir => dir.path === path)) {
        logger.info(`Directory \`${relativePath}/\` ${event === 'addDir' ? 'created' : 'removed'}`)
        return nuxt.callHook('restart')
      }
    })

    const serverPlaceholderPath = resolve(distDir, 'app/components/server-placeholder')

    // Scan components and add to plugin
    nuxt.hook('app:templates', async (app) => {
      const newComponents = await scanComponents(componentDirs, nuxt.options.srcDir!)
      await nuxt.callHook('components:extend', newComponents)
      // add server placeholder for .client components server side. issue: #7085
      for (const component of newComponents) {
        if (component.mode === 'client' && !newComponents.some(c => c.pascalName === component.pascalName && c.mode === 'server')) {
          newComponents.push({
            ...component,
            _raw: true,
            mode: 'server',
            filePath: serverPlaceholderPath,
            chunkName: 'components/' + component.kebabName,
          })
        }
        if (component.mode === 'server' && !nuxt.options.ssr && !newComponents.some(other => other.pascalName === component.pascalName && other.mode === 'client')) {
          logger.warn(`Using server components with \`ssr: false\` is not supported with auto-detected component islands. If you need to use server component \`${component.pascalName}\`, set \`experimental.componentIslands\` to \`true\`.`)
        }
      }
      context.components = newComponents
      app.components = newComponents
    })

    nuxt.hook('prepare:types', ({ tsConfig }) => {
      tsConfig.compilerOptions!.paths['#components'] = [resolve(nuxt.options.buildDir, 'components')]
    })

    // Watch for changes
    nuxt.hook('builder:watch', async (event, relativePath) => {
      if (!['add', 'unlink'].includes(event)) {
        return
      }
      const path = resolve(nuxt.options.srcDir, relativePath)
      if (componentDirs.some(dir => path.startsWith(dir.path + '/'))) {
        await updateTemplates({
          filter: template => [
            'components.plugin.mjs',
            'components.d.ts',
            'components.server.mjs',
            'components.client.mjs',
          ].includes(template.filename),
        })
      }
    })

    nuxt.hook('vite:extendConfig', (config, { isClient, isServer }) => {
      const mode = isClient ? 'client' : 'server'

      config.plugins = config.plugins || []
      if (isServer) {
        config.plugins.push(TreeShakeTemplatePlugin.vite({
          sourcemap: !!nuxt.options.sourcemap[mode],
          getComponents,
        }))
      }
      if (nuxt.options.experimental.clientFallback) {
        config.plugins.push(clientFallbackAutoIdPlugin.vite({
          sourcemap: !!nuxt.options.sourcemap[mode],
          rootDir: nuxt.options.rootDir,
        }))
      }
      config.plugins.push(loaderPlugin.vite({
        sourcemap: !!nuxt.options.sourcemap[mode],
        getComponents,
        mode,
        transform: typeof nuxt.options.components === 'object' && !Array.isArray(nuxt.options.components) ? nuxt.options.components.transform : undefined,
        experimentalComponentIslands: !!nuxt.options.experimental.componentIslands,
      }))

      if (nuxt.options.experimental.componentIslands) {
        const selectiveClient = typeof nuxt.options.experimental.componentIslands === 'object' && nuxt.options.experimental.componentIslands.selectiveClient

        if (isClient && selectiveClient) {
          fs.writeFileSync(join(nuxt.options.buildDir, 'components-chunk.mjs'), 'export const paths = {}')
          if (!nuxt.options.dev) {
            config.plugins.push(componentsChunkPlugin.vite({
              getComponents,
              buildDir: nuxt.options.buildDir,
            }))
          } else {
            fs.writeFileSync(join(nuxt.options.buildDir, 'components-chunk.mjs'), `export const paths = ${JSON.stringify(
              getComponents().filter(c => c.mode === 'client' || c.mode === 'all').reduce((acc, c) => {
                if (c.filePath.endsWith('.vue') || c.filePath.endsWith('.js') || c.filePath.endsWith('.ts')) { return Object.assign(acc, { [c.pascalName]: `/@fs/${c.filePath}` }) }
                const filePath = fs.existsSync(`${c.filePath}.vue`) ? `${c.filePath}.vue` : fs.existsSync(`${c.filePath}.js`) ? `${c.filePath}.js` : `${c.filePath}.ts`
                return Object.assign(acc, { [c.pascalName]: `/@fs/${filePath}` })
              }, {} as Record<string, string>),
            )}`)
          }
        }

        if (isServer) {
          config.plugins.push(islandsTransform.vite({
            getComponents,
            selectiveClient,
          }))
        }
      }
      if (!isServer && nuxt.options.experimental.componentIslands) {
        config.plugins.push({
          name: 'nuxt-server-component-hmr',
          handleHotUpdate (ctx) {
            const components = getComponents()
            const filePath = normalize(ctx.file)
            const comp = components.find(c => c.filePath === filePath)
            if (comp?.mode === 'server') {
              ctx.server.ws.send({
                event: `nuxt-server-component:${comp.pascalName}`,
                type: 'custom',
              })
            }
          },
        })
      }
    })
    nuxt.hook('webpack:config', (configs) => {
      configs.forEach((config) => {
        const mode = config.name === 'client' ? 'client' : 'server'
        config.plugins = config.plugins || []
        if (mode === 'server') {
          config.plugins.push(TreeShakeTemplatePlugin.webpack({
            sourcemap: !!nuxt.options.sourcemap[mode],
            getComponents,
          }))
        }
        if (nuxt.options.experimental.clientFallback) {
          config.plugins.push(clientFallbackAutoIdPlugin.webpack({
            sourcemap: !!nuxt.options.sourcemap[mode],
            rootDir: nuxt.options.rootDir,
          }))
        }
        config.plugins.push(loaderPlugin.webpack({
          sourcemap: !!nuxt.options.sourcemap[mode],
          getComponents,
          mode,
          transform: typeof nuxt.options.components === 'object' && !Array.isArray(nuxt.options.components) ? nuxt.options.components.transform : undefined,
          experimentalComponentIslands: !!nuxt.options.experimental.componentIslands,
        }))

        if (nuxt.options.experimental.componentIslands) {
          if (mode === 'server') {
            config.plugins.push(islandsTransform.webpack({
              getComponents,
            }))
          } else {
            fs.writeFileSync(join(nuxt.options.buildDir, 'components-chunk.mjs'), 'export const paths = {}')
          }
        }
      })
    })
  },
})
