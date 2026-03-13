import { joinRelativeURL } from 'ufo'
import { useRuntimeConfig } from 'nitro/runtime-config'

const config = useRuntimeConfig()

export function baseURL (): string {
  return config.app.baseURL
}

export function buildAssetsDir (): string {
  return config.app.buildAssetsDir as string
}

export function buildAssetsURL (...path: string[]): string {
  return joinRelativeURL(publicAssetsURL(), buildAssetsDir(), ...path)
}

export function publicAssetsURL (...path: string[]): string {
  const app = config.app
  const publicBase = app.cdnURL as string || app.baseURL
  return path.length ? joinRelativeURL(publicBase, ...path) : publicBase
}
