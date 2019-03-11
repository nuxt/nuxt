# Nuxt with Axios Proxy Example

Using [proxy-module](https://github.com/nuxt-community/proxy-module) and [Axios module](https://axios.nuxtjs.org/)

> proxy-module is the one-liner node.js http-proxy middleware solution for Nuxt.js using [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware)

> Axios-module is a secure and easy [Axios](https://github.com/mzabriskie/axios) integration with Nuxt.js.

## Install

```bash
$ yarn add @nuxtjs/axios @nuxtjs/proxy
```

## Nuxt.config.js

```json
{
  modules: [
    '@nuxtjs/axios',
    '@nuxtjs/proxy'
  ],
  proxy: [
    ['/api/dog', { target: 'https://dog.ceo/', pathRewrite: { '^/api/dog': '/api/breeds/image/random' } }]
  ]
}
```

### Use Axios

```js
async asyncData({ app }) {
  const ip = await app.$axios.$get('http://icanhazip.com')
  return { ip }
}
```

More detail, please refer [axios-module](https://github.com/nuxt-community/axios-module).
