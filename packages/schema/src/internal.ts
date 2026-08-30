/**
 * Types shared between first-party Nuxt packages (nuxt, kit, vite, nitro-server,
 * vite-server). Not public API: anything exported here may change in any release, and
 * third-party modules should not depend on it.
 *
 * @internal
 */

export type {
  NuxtServerBuild,
  NuxtServerBuildCapabilities,
  NuxtServerBuildOutput,
  NuxtServerBuildPreview,
  NuxtServerBuildRuntime,
} from './types/nuxt.ts'
