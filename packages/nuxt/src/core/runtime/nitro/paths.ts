import { joinURL } from 'ufo'
import { useRuntimeConfig } from '#internal/nitro'

export function baseURL (): string {
  return useRuntimeConfig().app.baseURL
}

export function buildAssetsDir (): string {
  return useRuntimeConfig().app.buildAssetsDir as string
}

export function buildAssetsURL (...path: string[]): string {
  return joinURL(publicAssetsURL(), buildAssetsDir(), ...path)
}

export function publicAssetsURL (...path: string[]): string {
  const publicBase = useRuntimeConfig().app.cdnURL as string || useRuntimeConfig().app.baseURL
  return path.length ? joinURL(publicBase, ...path) : publicBase
}
