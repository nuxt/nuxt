import { resolve, dirname } from 'pathe'
import fse from 'fs-extra'
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
        // Bundle ts
        if (_id.endsWith('.ts')) {
          return null
        }
      }

      // Track externals
      if (opts.trace !== false) {
        const resolved = await this.resolve(originalId, importer, { ...options, skipSelf: true }).then(r => r.id)
        trackedExternals.add(resolved)
      }

      return {
        id: _id,
        external: true
      }
    },
    async buildEnd () {
      if (opts.trace !== false) {
        const tracedFiles = await nodeFileTrace(Array.from(trackedExternals), opts.traceOptions)
          .then(r => r.fileList.map(f => resolve(opts.traceOptions.base, f)))
          .then(r => r.filter(file => file.includes('node_modules')))

        // // Find all unique package names
        const pkgs = new Set<string>()
        for (const file of tracedFiles) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const [_, baseDir, pkgName, _importPath] = /(.+\/node_modules\/)([^@/]+|@[^/]+\/[^/]+)\/(.*)/.exec(file)
          pkgs.add(resolve(baseDir, pkgName, 'package.json'))
        }

        for (const pkg of pkgs) {
          if (!tracedFiles.includes(pkg)) {
            tracedFiles.push(pkg)
          }
        }

        const writeFile = async (file) => {
          const src = resolve(opts.traceOptions.base, file)
          const dst = resolve(opts.outDir, 'node_modules', file.split('node_modules/').pop())
          await fse.mkdirp(dirname(dst))
          await fse.copyFile(src, dst)
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
