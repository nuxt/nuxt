import { joinURL } from 'ufo'

export const baseURL = () => '/'
export const buildAssetsURL = (url: string) => joinURL('/_nuxt', url)
