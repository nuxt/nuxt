import { performance } from 'node:perf_hooks'
import type { Nuxt } from '@nuxt/schema'
import type { DevEnvironment, Plugin } from 'vite'
import { isBundlerTracingEnabled, traceAsync } from '../utils/tracing.ts'

const HOOKS_TO_TRACK = ['transform', 'resolveId', 'load'] as const

export function PerfPlugin (nuxt: Nuxt): Plugin {
  const tracing = isBundlerTracingEnabled(nuxt)
  const wrapped = new WeakSet<Plugin>()
  const wrapPlugins = (plugins: readonly Plugin[]) => {
    for (const plugin of plugins) {
      if (plugin.name === 'nuxt:perf' || wrapped.has(plugin)) { continue }
      wrapped.add(plugin)
      for (const hookName of HOOKS_TO_TRACK) {
        wrapPluginHook(plugin, plugin.name, hookName, nuxt, tracing)
      }
    }
  }
  return {
    name: 'nuxt:perf',
    enforce: 'pre',
    apply: () => !!nuxt?._perf || tracing,
    configResolved (config) {
      wrapPlugins(config.plugins)
    },
    configureServer (server) {
      for (const name in server.environments) {
        const environment = server.environments[name]!
        wrapPlugins(environment.plugins)
        if (tracing && name !== 'client') {
          traceFetchModule(environment)
        }
      }
    },
    buildStart () {
      wrapPlugins(this.environment.plugins)
    },
  }
}

function traceFetchModule (environment: DevEnvironment): void {
  const fetchModule = environment.fetchModule
  environment.fetchModule = function (id, ...rest) {
    return traceAsync('nuxt.bundler.module', { id, environment: environment.name }, () => fetchModule.call(this, id, ...rest)) as ReturnType<typeof fetchModule>
  }
}

function wrapPluginHook (plugin: Plugin, pluginName: string, hookName: typeof HOOKS_TO_TRACK[number], nuxt: Nuxt, tracing: boolean): void {
  const original = plugin[hookName]
  if (!original) { return }

  if (typeof original === 'function') {
    ;(plugin as any)[hookName] = function (this: any, ...args: any[]) {
      return timedCall(original as (...a: any[]) => any, this, args, pluginName, hookName, nuxt, tracing)
    }
  } else if (typeof original === 'object' && 'handler' in original) {
    const originalHandler = original.handler as (...a: any[]) => any
    ;(original as { handler: (...a: any[]) => any }).handler = function (this: any, ...args: any[]) {
      return timedCall(originalHandler, this, args, pluginName, hookName, nuxt, tracing)
    }
  }
}

function timedCall (fn: (...a: any[]) => any, ctx: any, args: any[], pluginName: string, hookName: typeof HOOKS_TO_TRACK[number], nuxt: Nuxt, tracing: boolean): any {
  const call = tracing
    ? () => traceAsync('nuxt.bundler.plugin', {
        plugin: pluginName,
        hook: hookName,
        id: hookName === 'transform' ? args[1] : args[0],
        environment: ctx?.environment?.name,
      }, () => fn.apply(ctx, args))
    : () => fn.apply(ctx, args)
  if (!nuxt._perf) {
    return call()
  }
  const start = performance.now()
  const record = () => nuxt._perf?.recordBundlerPluginHook(pluginName, hookName, performance.now() - start, start)
  try {
    const result = call()
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
