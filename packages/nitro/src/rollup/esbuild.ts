// Based on https://github.com/egoist/rollup-plugin-esbuild (MIT)

import { existsSync, statSync } from 'fs'
import { extname, resolve, dirname, join, relative } from 'path'
import { Plugin, PluginContext } from 'rollup'
import { startService, Loader, Service, TransformResult } from 'esbuild'
import { createFilter, FilterPattern } from '@rollup/pluginutils'

const defaultLoaders: { [ext: string]: Loader } = {
  '.ts': 'ts'
}

export type Options = {
  include?: FilterPattern
  exclude?: FilterPattern
  sourceMap?: boolean
  minify?: boolean
  target?: string | string[]
  jsxFactory?: string
  jsxFragment?: string
  define?: {
    [k: string]: string
  }
  /**
   * Use this tsconfig file instead
   * Disable it by setting to `false`
   */
  tsconfig?: string | false
  /**
   * Map extension to esbuild loader
   * Note that each entry (the extension) needs to start with a dot
   */
  loaders?: {
    [ext: string]: Loader | false
  }
}

export default (options: Options = {}): Plugin => {
  let target: string | string[]

  const loaders = {
    ...defaultLoaders
  }

  if (options.loaders) {
    for (const key of Object.keys(options.loaders)) {
      const value = options.loaders[key]
      if (typeof value === 'string') {
        loaders[key] = value
      } else if (value === false) {
        delete loaders[key]
      }
    }
  }

  const extensions: string[] = Object.keys(loaders)
  const INCLUDE_REGEXP = new RegExp(
    `\\.(${extensions.map(ext => ext.slice(1)).join('|')})$`
  )
  const EXCLUDE_REGEXP = /node_modules/

  const filter = createFilter(
    options.include || INCLUDE_REGEXP,
    options.exclude || EXCLUDE_REGEXP
  )

  let service: Service | undefined

  const stopService = () => {
    if (service) {
      service.stop()
      service = undefined
    }
  }

  return {
    name: 'esbuild',

    async buildStart () {
      if (!service) {
        service = await startService()
      }
    },

    async transform (code, id) {
      if (!filter(id)) {
        return null
      }

      const ext = extname(id)
      const loader = loaders[ext]

      if (!loader || !service) {
        return null
      }

      target = options.target || 'node12'

      const result = await service.transform(code, {
        loader,
        target,
        define: options.define,
        sourcemap: options.sourceMap !== false,
        sourcefile: id
      })

      printWarnings(id, result, this)

      return (
        result.code && {
          code: result.code,
          map: result.map || null
        }
      )
    },

    buildEnd (error) {
      // Stop the service early if there's error
      if (error && !this.meta.watchMode) {
        stopService()
      }
    },

    async renderChunk (code) {
      if (options.minify && service) {
        const result = await service.transform(code, {
          loader: 'js',
          minify: true,
          target
        })
        if (result.code) {
          return {
            code: result.code,
            map: result.map || null
          }
        }
      }
      return null
    },

    generateBundle () {
      if (!this.meta.watchMode) {
        stopService()
      }
    }
  }
}

function printWarnings (
  id: string,
  result: TransformResult,
  plugin: PluginContext
) {
  if (result.warnings) {
    for (const warning of result.warnings) {
      let message = '[esbuild]'
      if (warning.location) {
        message += ` (${relative(process.cwd(), id)}:${warning.location.line}:${warning.location.column
          })`
      }
      message += ` ${warning.text}`
      plugin.warn(message)
    }
  }
}
