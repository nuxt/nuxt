import { createRequire } from 'node:module'
import clear from 'clear'
import { bold, gray, green } from 'colorette'
import { version } from '../../package.json'

export function showBanner (_clear?: boolean) {
  if (_clear) { clear() }
  console.log(gray(`Nuxi ${(bold(version))}`))
}

export function showVersions (cwd: string) {
  const _require = createRequire(cwd)
  const getPkgVersion = (pkg: string) => {
    try {
      const { version } = _require(`${pkg}/package.json`)
      return version || ''
    } catch { /* not found */ }
    return ''
  }
  const nuxtVersion = getPkgVersion('nuxt') || getPkgVersion('nuxt-edge')
  const nitroVersion = getPkgVersion('nitropack')
  console.log(gray(
    green(`Nuxt ${bold(nuxtVersion)}`) +
    (nitroVersion ? ` with Nitro ${(bold(nitroVersion))}` : '')
  ))
}
