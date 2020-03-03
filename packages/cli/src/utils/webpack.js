import { core as importCore, builder as importBuilder } from '../imports'

export async function getWebpackConfig (name = 'client', loadOptions = {}) {
  const { loadNuxt } = await importCore()
  const { getBuilder } = await importBuilder()

  const nuxt = await loadNuxt(loadOptions)
  const builder = await getBuilder(nuxt)
  const { bundleBuilder } = builder
  return bundleBuilder.getWebpackConfig(name)
}
