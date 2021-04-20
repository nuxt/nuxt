import type { Plugin } from 'rollup'
import { resolve, dirname } from 'upath'
import { copyFile, mkdirp } from 'fs-extra'
import { nodeFileTrace, NodeFileTraceOptions } from '@vercel/nft'

export interface NodeExternalsOptions {
  ignore?: string[]
  outDir?: string
  trace?: boolean
  traceOptions?: NodeFileTraceOptions
  moduleDirectories?: string[]
}

export function externals (opts: NodeExternalsOptions): Plugin {
  const resolvedExternals = new Set<string>()

  return {
    name: 'node-externals',
    resolveId (id) {
      // Internals
      if (!id || id.startsWith('\x00') || id.includes('?') || id.startsWith('#')) {
        return null
      }

      // Normalize from node_modules
      const _id = id.split('node_modules/').pop()

      // Resolve relative paths and exceptions
      if (_id.startsWith('.') || opts.ignore.find(i => _id.startsWith(i))) {
        return null
      }

      // Bundle ts
      if (_id.endsWith('.ts')) {
        return null
      }

      // Try to resolve for nft
      if (opts.trace !== false) {
        let _resolvedId = _id
        try { _resolvedId = require.resolve(_resolvedId, { paths: opts.moduleDirectories }) } catch (_err) {}
        resolvedExternals.add(_resolvedId)
      }

      return {
        id: _id,
        external: true
      }
    },
    async buildEnd () {
      if (opts.trace !== false) {
        const tracedFiles = await nodeFileTrace(Array.from(resolvedExternals), opts.traceOptions)
          .then(r => r.fileList.map(f => resolve(opts.traceOptions.base, f)))

        await Promise.all(tracedFiles.map(async (file) => {
          if (!file.includes('node_modules')) {
            return
          }
          // TODO: Minify package.json
          const src = resolve(opts.traceOptions.base, file)
          const dst = resolve(opts.outDir, 'node_modules', file.split('node_modules/').pop())
          await mkdirp(dirname(dst))
          await copyFile(src, dst)
        }))
      }
    }
  }
}
