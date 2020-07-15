import { loadNuxt } from 'nuxt/core'
import { getBuilder } from 'nuxt/builder'

export async function getWebpackConfig(name = 'client', loadOptions = {}) {
  const nuxt = await loadNuxt(loadOptions)
  const builder = await getBuilder(nuxt)
  const { bundleBuilder } = builder
  return bundleBuilder.getWebpackConfig(name)
}
