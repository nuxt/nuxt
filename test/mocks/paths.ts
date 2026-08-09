import { joinURL } from 'ufo'

export const buildAssetsURL = (url: string) => joinURL('/_nuxt', url)
