import { joinURL } from 'ufo'
import config from '#config'

export function baseURL () {
  return config.app.baseURL
}

export function buildAssetsDir () {
  return config.app.buildAssetsDir
}

export function buildAssetsURL (...path: string[]) {
  return joinURL(publicAssetsURL(), config.app.buildAssetsDir, ...path)
}

export function publicAssetsURL (...path: string[]) {
  const publicBase = config.app.cdnURL || config.app.baseURL
  return path.length ? joinURL(publicBase, ...path) : publicBase
}
