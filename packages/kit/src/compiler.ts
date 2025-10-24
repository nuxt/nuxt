import type { ScanPlugin } from '@nuxt/schema'
import { useNuxt } from './context'

/**
 * Registers a nuxt compiler scan plugin.
 */
export function addCompilerScanPlugin (plugin: ScanPlugin) {
  const nuxt = useNuxt()
  nuxt.options.compiler ||= {}
  nuxt.options.compiler.plugins ||= []
  nuxt.options.compiler.plugins.push(plugin)
  return plugin
}

export function createCompilerScanPlugin (plugin: ScanPlugin): ScanPlugin
export function createCompilerScanPlugin (factory: () => ScanPlugin): ScanPlugin
export function createCompilerScanPlugin (arg: ScanPlugin | (() => ScanPlugin)): ScanPlugin {
  return typeof arg === 'function' ? arg() : arg
}
