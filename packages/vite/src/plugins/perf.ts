import { performance } from 'node:perf_hooks'
import type { Nuxt } from '@nuxt/schema'
import type { Plugin } from 'vite'

const HOOKS_TO_TRACK = ['transform', 'resolveId', 'load'] as const

export function PerfPlugin (nuxt: Nuxt): Plugin {
  return {
    name: 'nuxt:perf',
    enforce: 'pre',
    apply: () => !!nuxt?._perf,
    configResolved (config) {
      for (const plugin of config.plugins) {
        if (plugin.name === 'nuxt:perf') { continue }
        const pluginName = plugin.name
        for (const hookName of HOOKS_TO_TRACK) {
          wrapPluginHook(plugin, pluginName, hookName, nuxt)
        }
      }
    },
  }
}

function wrapPluginHook (plugin: Plugin, pluginName: string, hookName: string, nuxt: Nuxt): void {
  const original = plugin[hookName as keyof Plugin]
  if (!original) { return }

  if (typeof original === 'function') {
    ;(plugin as any)[hookName] = function (this: any, ...args: any[]) {
      return timedCall(original as (...a: any[]) => any, this, args, pluginName, hookName, nuxt)
    }
  } else if (typeof original === 'object' && 'handler' in original) {
    const originalHandler = original.handler
    original.handler = function (...args: any[]) {
      return timedCall(originalHandler, this, args, pluginName, hookName, nuxt)
    }
  }
}

function timedCall (fn: (...a: any[]) => any, ctx: any, args: any[], pluginName: string, hookName: string, nuxt: Nuxt): any {
  const start = performance.now()
  const record = () => nuxt._perf?.recordBundlerPluginHook(pluginName, hookName, performance.now() - start, start)
  try {
    const result = fn.apply(ctx, args)
    if (result && typeof result === 'object' && 'then' in result) {
      return (result as Promise<any>).finally(record)
    }
    record()
    return result
  } catch (err) {
    record()
    throw err
  }
}
