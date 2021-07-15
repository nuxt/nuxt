# PM2

> How to deploy Nuxt to a Node.js host with Nuxt Nitro

- Support for ultra-minimal SSR build
- Zero millisecond cold start
- More configuration required

## Setup

Make sure another preset isn't set in `nuxt.config`.

```ts [nuxt.config.js]
export default {
  nitro: {
    // this is the default preset so you can also just omit it entirely
    // preset: 'server'
  }
}
```

## Deployment

After running `yarn build`, all you need is in the `.output` folder. Static assets are in the `public` subdirectory and the server and its dependencies are within the `server` subdirectory.

This `.output` folder can be deployed to your Node.js host and the server can be run using [`pm2`](https://pm2.keymetrics.io/docs/).

To start the server in production mode, run:

```bash
node .output/server/index.mjs
```

For example, using `pm2`:

```js [ecosystem.config.js]
module.exports = {
  apps: [
    {
      name: 'NuxtAppName',
      exec_mode: 'cluster',
      instances: 'max',
      script: './.output/server/index.js'
    }
  ]
}
```

## More information

See [more information on the server preset](/presets/server).
