import type { Nuxt } from '@nuxt/schema'
import type { DevEnvironment, Plugin } from 'vite'
import { isBundlerTracingEnabled, traceAsync } from '../utils/tracing.ts'

const HOOKS_TO_TRACK = ['transform', 'resolveId', 'load'] as const

type HookHandler = (...args: any[]) => any

interface TimedHandler {
  handler: HookHandler
  pluginName: string
  hookName: typeof HOOKS_TO_TRACK[number]
}

export function PerfPlugin (nuxt: Nuxt): Plugin {
  const tracing = isBundlerTracingEnabled(nuxt)
  const timedHandlers = new WeakMap<HookHandler, TimedHandler>()
  const wrapPlugins = (plugins: readonly Plugin[]) => {
    for (const plugin of plugins) {
      if (plugin.name === 'nuxt:perf') { continue }
      for (const hookName of HOOKS_TO_TRACK) {
        wrapPluginHook(plugin, plugin.name, hookName, nuxt, tracing, timedHandlers)
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
    buildApp: {
      order: 'pre',
      handler (builder) {
        const perf = nuxt._perf
        if (perf) {
          const build = builder.build
          builder.build = async (environment) => {
            perf.startPhase(`vite:${environment.name}`)
            const output = await build.call(builder, environment)
            // a build that throws stays open, so the report shows it as unfinished
            perf.endPhase(`vite:${environment.name}`)
            return output
          }
        }
        return Promise.resolve()
      },
    },
  }
}

function traceFetchModule (environment: DevEnvironment): void {
  const fetchModule = environment.fetchModule
  environment.fetchModule = function (id, ...rest) {
    return traceAsync('nuxt.bundler.module', { url: id, environment: environment.name }, () => fetchModule.call(this, id, ...rest)) as ReturnType<typeof fetchModule>
  }
}

function wrapPluginHook (plugin: Plugin, pluginName: string, hookName: typeof HOOKS_TO_TRACK[number], nuxt: Nuxt, tracing: boolean, timedHandlers: WeakMap<HookHandler, TimedHandler>): void {
  const hook = plugin[hookName]
  const current = typeof hook === 'function' ? hook : hook?.handler
  if (!hook || typeof current !== 'function') { return }
  const timedHandler = timedHandlers.get(current)
  if (timedHandler?.pluginName === pluginName && timedHandler.hookName === hookName) { return }
  const handler = timedHandler?.handler ?? current
  const timed = function (this: any, ...args: any[]) {
    return timedCall(handler, this, args, pluginName, hookName, nuxt, tracing)
  }
  timedHandlers.set(timed, { handler, pluginName, hookName })
  // frozen plugins are left untimed rather than throwing
  if (typeof hook === 'function') {
    Reflect.set(plugin, hookName, timed)
    return
  }
  // timed in place so later changes to the hook object (such as to `filter`) still apply,
  // unless the object is already timed for another plugin or hook
  if (timedHandler || !Reflect.set(hook, 'handler', timed)) {
    Reflect.set(plugin, hookName, { ...hook, handler: timed })
  }
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
