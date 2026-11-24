import { Buffer } from 'node:buffer'
import module from 'node:module'
import process from 'node:process'

const loaded = new Map()
const bootBuiltins = new Set(process.moduleLoadList)

module.registerHooks({
  load (url, context, nextLoad) {
    const result = nextLoad(url, context)
    if (!loaded.has(url)) {
      const source = result.source
      loaded.set(url, typeof source === 'string' ? Buffer.byteLength(source) : source ? source.byteLength : 0)
    }
    return result
  },
})

process.on('exit', () => {
  let bytes = 0
  for (const size of loaded.values()) {
    bytes += size
  }
  const builtins = process.moduleLoadList.filter(entry => entry.startsWith('NativeModule ') && !bootBuiltins.has(entry)).length
  // `_rawDebug` writes straight to fd 2, so the CLI's own logging cannot intercept it
  process._rawDebug(`__BENCH_MODULES__${JSON.stringify({ modules: loaded.size, bytes, builtins })}`)
})
