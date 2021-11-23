import { promises as fsp } from 'fs'
import { resolve, dirname } from 'pathe'
import { nodeFileTrace, NodeFileTraceOptions } from '@vercel/nft'
import type { Plugin } from 'rollup'

export interface NodeExternalsOptions {
  inline?: string[]
  external?: string[]
  outDir?: string
  trace?: boolean
  traceOptions?: NodeFileTraceOptions
  moduleDirectories?: string[]
}

export function externals (opts: NodeExternalsOptions): Plugin {
  const trackedExternals = new Set<string>()

  return {
    name: 'node-externals',
    async resolveId (id, importer, options) {
      // Internals
      if (!id || id.startsWith('\x00') || id.includes('?') || id.startsWith('#')) {
        return null
      }

      const originalId = id

      // Normalize path on windows
      if (process.platform === 'win32') {
        if (id.startsWith('/')) {
          // Add back C: prefix on Windows
          id = resolve(id)
        }
        id = id.replace(/\\/g, '/')
      }

      // Normalize from node_modules
      const _id = id.split('node_modules/').pop()

      // Skip checks if is an explicit external
      if (!opts.external.find(i => _id.startsWith(i) || id.startsWith(i))) {
        // Resolve relative paths and exceptions
        // Ensure to take absolute and relative id
        if (_id.startsWith('.') || opts.inline.find(i => _id.startsWith(i) || id.startsWith(i))) {
          return null
        }
        // Bundle typescript, json and wasm (see https://github.com/nuxt/framework/discussions/692)
        if (/\.(ts|wasm|json)$/.test(_id)) {
          return null
        }
      }

      // Track externals
      if (opts.trace !== false) {
        const resolved = await this.resolve(originalId, importer, { ...options, skipSelf: true })
        if (!resolved) {
          console.warn(`Could not resolve \`${originalId}\`. Have you installed it?`)
        } else {
          trackedExternals.add(resolved.id)
        }
      }

      return {
        id: _id,
        external: true
      }
    },
    async buildEnd () {
      if (opts.trace !== false) {
        const tracedFiles = await nodeFileTrace(Array.from(trackedExternals), opts.traceOptions)
          .then(r => Array.from(r.fileList).map(f => resolve(opts.traceOptions.base, f)))
          .then(r => r.filter(file => file.includes('node_modules')))

        // // Find all unique package names
        const pkgs = new Set<string>()
        for (const file of tracedFiles) {
          const [, baseDir, pkgName, _importPath] = /^(.+\/node_modules\/)([^@/]+|@[^/]+\/[^/]+)(\/?.*?)?$/.exec(file)
          pkgs.add(resolve(baseDir, pkgName, 'package.json'))
        }

        for (const pkg of pkgs) {
          if (!tracedFiles.includes(pkg)) {
            tracedFiles.push(pkg)
          }
        }

        const writeFile = async (file) => {
          if (!await isFile(file)) { return }
          const src = resolve(opts.traceOptions.base, file)
          const dst = resolve(opts.outDir, 'node_modules', file.replace(/^.*?node_modules[\\/](.*)$/, '$1'))
          await fsp.mkdir(dirname(dst), { recursive: true })
          await fsp.copyFile(src, dst)
        }
        if (process.platform === 'win32') {
          // Workaround for EBUSY on windows (#424)
          for (const file of tracedFiles) {
            await writeFile(file)
          }
        } else {
          await Promise.all(tracedFiles.map(writeFile))
        }
      }
    }
  }
}

async function isFile (file: string) {
  try {
    const stat = await fsp.stat(file)
    return stat.isFile()
  } catch (err) {
    if (err.code === 'ENOENT') { return false }
    throw err
  }
}
