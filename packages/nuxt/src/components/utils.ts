import type { EnvironmentModuleNode, HotUpdateOptions, Plugin } from 'vite'
import { normalize } from 'pathe'
import type { Nuxt } from '@nuxt/schema'
import { componentDiagnostics } from '@nuxt/kit/internal'
import { installNuxtModule } from '../core/features.ts'
import { linkToAlias } from '../utils.ts'
import type { Component } from 'nuxt/schema'

export const HYDRATION_STRATEGIES = ['Idle', 'Visible', 'Interaction', 'MediaQuery', 'If', 'Never', 'Time'] as const
export type HydrationStrategy = typeof HYDRATION_STRATEGIES[number]

/** The prop of a lazy component that selects each hydration strategy. */
export const HYDRATION_PROPS: Record<string, HydrationStrategy> = {
  hydrateOnIdle: 'Idle',
  hydrateOnVisible: 'Visible',
  hydrateOnInteraction: 'Interaction',
  hydrateOnMediaQuery: 'MediaQuery',
  hydrateAfter: 'Time',
  hydrateWhen: 'If',
  hydrateNever: 'Never',
}

/** The export of `components/runtime/lazy-hydrated-component` that implements a hydration strategy. */
export function lazyHydrationFactory (strategy: HydrationStrategy) {
  return `createLazy${strategy}Component`
}

/** Install the module a component belongs to, if it is an optional Nuxt feature that is not yet installed. */
export function installComponentModule (component: Component, importer: string, nuxt: Nuxt | null | undefined) {
  const internalInstall = (component as { _internal_install?: string })._internal_install
  if (!internalInstall || nuxt?.options.test !== false) { return }
  if (!nuxt.options.dev) {
    throw componentDiagnostics.NUXT_B3004({ file: linkToAlias(importer, nuxt), component: component.pascalName, requiredModule: internalInstall })
  }
  installNuxtModule(internalInstall)
}

type ResolutionKeys = Map<string, Map<string, string | undefined>>

/**
 * A Vite `hotUpdate` hook that rescans components when a component file is added or removed, and
 * invalidates the modules in `resolutions` with a reference that now resolves differently.
 */
export function createComponentsHotUpdate (
  refreshComponents: ((file: string, timestamp: number) => void | Promise<void>) | undefined,
  resolutions: ResolutionKeys,
  resolve: (id: string, reference: string) => string | undefined,
): Plugin['hotUpdate'] {
  return {
    order: 'pre',
    async handler ({ type, file, timestamp, modules }: HotUpdateOptions) {
      if (type === 'update' || !refreshComponents) { return }
      const pending = refreshComponents(normalize(file), timestamp)
      if (!pending) { return }
      await pending

      const affected = new Set<EnvironmentModuleNode>(modules)
      for (const [id, references] of resolutions) {
        for (const [reference, key] of references) {
          if (resolve(id, reference) === key) { continue }
          const mod = this.environment.moduleGraph.getModuleById(id)
          if (mod) {
            affected.add(mod)
          } else {
            resolutions.delete(id)
          }
          break
        }
      }
      if (affected.size !== modules.length) {
        return [...affected]
      }
    },
  }
}
