import { joinRelativeURL } from 'ufo'
import { useRuntimeConfig } from '#internal/nitro'

export function baseURL (): string {
  // TODO: support passing event to `useRuntimeConfig`
  return useRuntimeConfig().app.baseURL
}

export function buildAssetsDir (): string {
  // TODO: support passing event to `useRuntimeConfig`
  return useRuntimeConfig().app.buildAssetsDir as string
}

export function buildAssetsURL (...path: string[]): string {
  return joinRelativeURL(publicAssetsURL(), buildAssetsDir(), ...path)
}

export function publicAssetsURL (...path: string[]): string {
  // TODO: support passing event to `useRuntimeConfig`
  const app = useRuntimeConfig().app
  const publicBase = app.cdnURL as string || app.baseURL
  return path.length ? joinRelativeURL(publicBase, ...path) : publicBase
}
