import type { NitroApp } from 'nitro/types'
import type { ViteNodeRunner } from 'vite-node/client'
import { SourceMapConsumer } from 'source-map-js'
import { viteNodeFetch } from '#vite-node'

export default (nitroApp: NitroApp): void => {
  let runner: ViteNodeRunner
  nitroApp.hooks?.hook('error', async (error) => {
    if (!error?.stack) { return }
    try {
      const originalStack = error.stack
      runner ||= await import('#internal/nuxt/vite-node-runner.mjs').then(m => m.default)
      runner.ssrFixStacktrace(error)

      if (error.stack !== originalStack) { return }

      const currentStack = error.stack
      Object.defineProperty(error, 'stack', {
        value: currentStack,
        writable: true,
        configurable: true,
      })

      const stackLines = error.stack.split('\n')
      const rewrittenLines = await Promise.all(
        stackLines.map(async (line) => {
          const match = line.match(/\((.*?:\d+:\d+)\)/) || line.match(/at\s+(.*?:\d+:\d+)/)
          if (!match) { return line }

          const fullLoc = match[1]
          const locParts = fullLoc.match(/^(.*):(\d+):(\d+)$/)
          if (!locParts) { return line }

          const [, filePath, lineNo, colNo] = locParts
          if (!filePath.endsWith('.vue')) { return line }

          const fetched = await viteNodeFetch.fetchModule(filePath).catch(() => undefined)
          const rawSourceMap = fetched?.map

          if (rawSourceMap) {
            const consumer = await new SourceMapConsumer(rawSourceMap as any)
            const orig = consumer.originalPositionFor({
              line: parseInt(lineNo, 10),
              column: parseInt(colNo, 10),
            })
            if (orig.line) {
              return line.replace(`:${lineNo}:${colNo}`, `:${orig.line}:${orig.column || 0}`)
            }
          }
          return line
        }),
      )

      error.stack = rewrittenLines.join('\n')
    } catch {
      // best-effort only; preserve original error
    }
  })
}
