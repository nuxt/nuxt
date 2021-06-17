import { getQuery } from 'ufo'

export default class NuxtSetupTransformerPlugin {
  apply (compiler) {
    compiler.options.module.rules.push({
      include (id) {
        const query = getQuery(id)
        return id.endsWith('.vue') || (query.nuxt && query.setup && query.type === 'script')
      },
      enforce: 'post',
      use: [{
        ident: 'NuxtSetupTransformerPlugin',
        loader: require.resolve('@nuxt/webpack-builder/dist/nuxt-setup-loader')
      }]
    })
  }
}
