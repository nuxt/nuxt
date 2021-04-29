import { requireModule } from '@nuxt/utils'

export const importModule = (id) => {
  try {
    return Promise.resolve(requireModule(id))
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      err.message = `Cannot import module '${id}'`
    }
    return Promise.reject(err)
  }
}

export const builder = () => importModule('@nuxt/builder')
export const webpack = () => importModule('@nuxt/webpack')
export const generator = () => importModule('@nuxt/generator')
export const core = () => importModule('@nuxt/core')
export const server = () => importModule('@nuxt/server')
