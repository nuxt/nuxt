export const builder = () => import('@nuxt/builder')
export const webpack = () => import('@nuxt/webpack')
export const generator = () => import('@nuxt/generator')
export const core = () => import('@nuxt/core')
export const module = (command) => {
  // TODO check for packages
  return import(`@nuxt/${command}`)
}
