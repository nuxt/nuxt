import { hasProtocol } from 'ufo'
// @ts-expect-error virtual file
import { nuxtLinkDefaults } from '#build/nuxt.config.mjs'

interface LinkAllowlistOptions {
  allowlist?: string[]
  externalRelAttribute?: string
}

/* @__NO_SIDE_EFFECTS__ */
export function useLinkAllowlist ({ allowlist, externalRelAttribute }: LinkAllowlistOptions = nuxtLinkDefaults) {
  function isUrlInAllowlist (url: string, allowlist: string[] = []): boolean {
    if (!allowlist.length) { return false }
    const urlObj = new URL(url, 'http://localhost')
    return allowlist.some(domain => urlObj.hostname.endsWith(domain))
  }
  const checkUrlInAllowlist = (url: string) => hasProtocol(url, { acceptRelative: true }) && isUrlInAllowlist(url, allowlist)

  const getCustomRel = (url: string, options?: {
    force: boolean
  }): string | undefined => {
    if (options?.force || (externalRelAttribute && checkUrlInAllowlist(url))) {
      return externalRelAttribute
    }
    return nuxtLinkDefaults.externalRelAttribute
  }

  return {
    allowlist,
    checkUrlInAllowlist,
    getCustomRel,
  }
}
