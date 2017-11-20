# Axios Proxy Example

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
