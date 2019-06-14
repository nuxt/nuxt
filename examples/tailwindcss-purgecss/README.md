# Nuxt Tailwind CSS + Purgecss

> Demo of using Nuxt with the community [nuxt-tailwindcss](https://github.com/nuxt-community/nuxt-tailwindcss) module to drastically reduce CSS size

## Using the module

In you nuxt.config.file add the plugin as a 'devModules':

```js
...
  devModules: ['@nuxtjs/tailwindcss']
...
```

_The module uses [postcss-preset-env](https://preset-env.cssdb.org/) includes and uses autoprefixer without additional configuration!_

## Demo

[https://nuxt-tailwindcss-demo.surge.sh/](https://nuxt-tailwindcss-demo.surge.sh/)

### Before and after stats

The before CSS bundle came out to **`353kb`**, where as using the plugin, it dropped to **`2.73kb`** (granted I'm only using around a dozen classes).

### Performance

And since the CSS remains inline (Nuxt does this by default) it scores perfect on Google Page Speed Insights! (This is after running `nuxt generate` and deploying the `dist` folder)
