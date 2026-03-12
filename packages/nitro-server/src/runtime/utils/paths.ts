import { joinRelativeURL } from 'ufo'
import { useRuntimeConfig } from 'nitropack/runtime'
import type { H3Event } from 'h3'

export function baseURL (event?: H3Event): string {
  return useRuntimeConfig(event).app.baseURL
}

export function buildAssetsDir (event?: H3Event): string {
  return useRuntimeConfig(event).app.buildAssetsDir as string
}

function parseEventAndSegments (args: unknown[]): { event?: H3Event, segments: string[] } {
  const [first, ...rest] = args as any[]
  const event = typeof first !== 'string' ? first : undefined
  const segments = typeof first !== 'string' ? rest : (args as string[])
  return { event, segments }
}

export function publicAssetsURL (event: H3Event | undefined, ...path: string[]): string
export function publicAssetsURL (...path: string[]): string
export function publicAssetsURL (...args: [H3Event | string | undefined, ...string[]]): string {
  const { event, segments } = parseEventAndSegments(args)
  const app = useRuntimeConfig(event).app
  const publicBase = app.cdnURL as string || app.baseURL

  return segments.length ? joinRelativeURL(publicBase, ...segments) : publicBase
}

export function buildAssetsURL (event: H3Event | undefined, ...path: string[]): string
export function buildAssetsURL (...path: string[]): string
export function buildAssetsURL (...args: [H3Event | string | undefined, ...string[]]): string {
  const { event, segments } = parseEventAndSegments(args)
  return joinRelativeURL(publicAssetsURL(event), buildAssetsDir(event), ...segments)
}
