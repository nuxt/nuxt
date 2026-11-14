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
    return traceAsync('nuxt.bundler.module', { url: id, environment: environment.name }, () => fetchModule.call(this, id, ...rest)) as ReturnType<typeof fetchModule>
  }
}

function wrapPluginHook (plugin: Plugin, pluginName: string, hookName: typeof HOOKS_TO_TRACK[number], nuxt: Nuxt, tracing: boolean): void {
  const hook = plugin[hookName]
  const handler = typeof hook === 'function' ? hook : hook?.handler
  if (typeof handler !== 'function') { return }
  const timed = function (this: any, ...args: any[]) {
    return timedCall(handler as (...a: any[]) => any, this, args, pluginName, hookName, nuxt, tracing)
  }
  // frozen plugins are left untimed rather than throwing
  Reflect.set(plugin, hookName, typeof hook === 'function' ? timed : { ...hook, handler: timed })
}

function timedCall (fn: (...a: any[]) => any, ctx: any, args: any[], pluginName: string, hookName: typeof HOOKS_TO_TRACK[number], nuxt: Nuxt, tracing: boolean): any {
  const call = (thisArg: any) => tracing
    ? traceAsync('nuxt.bundler.plugin', {
        plugin: pluginName,
        hook: hookName,
        id: hookName === 'transform' ? args[1] : args[0],
        environment: ctx?.environment?.name,
      }, () => fn.apply(thisArg, args))
    : fn.apply(thisArg, args)
  return nuxt._perf ? nuxt._perf.timeBundlerHook(pluginName, hookName, ctx, call) : call(ctx)
}
