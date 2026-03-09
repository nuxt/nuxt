import { type H3Event, isEvent as isH3Event } from 'h3'
import { joinRelativeURL } from 'ufo'
import { useRuntimeConfig } from 'nitropack/runtime'

export function baseURL (event?: H3Event): string {
  return useRuntimeConfig(event).app.baseURL
}

export function buildAssetsDir (event?: H3Event): string {
  return useRuntimeConfig(event).app.buildAssetsDir as string
}

export function publicAssetsURL (eventOrPath?: H3Event | string, ...path: string[]): string {
  const event = isH3Event(eventOrPath) ? eventOrPath : undefined
  const urls = isH3Event(eventOrPath) ? path : [eventOrPath as string, ...path].filter(Boolean) as string[]
  const app = useRuntimeConfig(event).app
  const publicBase = app.cdnURL as string || app.baseURL
  return urls.length ? joinRelativeURL(publicBase, ...urls) : publicBase
}

export function buildAssetsURL (eventOrPath?: H3Event | string, ...path: string[]): string {
  const event = isH3Event(eventOrPath) ? eventOrPath : undefined
  const urls = isH3Event(eventOrPath) ? path : [eventOrPath as string, ...path].filter(Boolean) as string[]
  return joinRelativeURL(publicAssetsURL(event), buildAssetsDir(event), ...urls)
}
