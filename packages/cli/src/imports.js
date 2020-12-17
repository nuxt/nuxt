import { requireModule } from '@nuxt/utils'

export const importModule = (id) => {
  try {
    return Promise.resolve(requireModule(id))
  } catch (err) {
    return Promise.reject(err)
  }
}

export const builder = () => importModule('@nuxt/builder')
export const webpack = () => importModule('@nuxt/webpack')
export const generator = () => importModule('@nuxt/generator')
export const core = () => importModule('@nuxt/core')
export const server = () => importModule('@nuxt/server')
