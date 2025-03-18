import { hasProtocol } from 'ufo'
// @ts-expect-error virtual file
import { nuxtLinkDefaults } from '#build/nuxt.config.mjs'

interface LinkWhitelistOptions {
  whitelist?: string[]
  externalRelAttribute?: string
}

/* @__NO_SIDE_EFFECTS__ */
export function useLinkWhitelist ({ whitelist, externalRelAttribute }: LinkWhitelistOptions = nuxtLinkDefaults) {
  function isUrlInWhitelist (url: string, whitelist: string[] = []): boolean {
    if (!whitelist.length) { return false }
    const urlObj = new URL(url, 'http://localhost')
    return whitelist.some(domain => urlObj.hostname.endsWith(domain))
  }
  const checkUrlInWhitelist = (url: string) => hasProtocol(url, { acceptRelative: true }) && isUrlInWhitelist(url, whitelist)

  const getCustomRel = (url: string, options?: {
    force: boolean
  }): string | undefined => {
    if (options?.force || (externalRelAttribute && checkUrlInWhitelist(url))) {
      return externalRelAttribute
    }
    return nuxtLinkDefaults.externalRelAttribute
  }

  return {
    whitelist,
    checkUrlInWhitelist,
    getCustomRel,
  }
}
