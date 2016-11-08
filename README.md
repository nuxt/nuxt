## Under development, will be release soon :fire:

# nuxt.js
>A minimalistic framework for server-rendered Vue applications (inspired from [Next.js](https://github.com/zeit/next.js))

## How to use

```
$ npm install nuxt --save
```

Add a script to your package.json like this:

```json
{
  "scripts": {
    "start": "nuxt"
  }
}
```

After that, the file-system is the main API. Every .vue file becomes a route that gets automatically processed and rendered.

Populate `./pages/index.vue` inside your project:

```html
<template>
  <h1>Hello {{ name }}!</h1>
</template>

<script>
export default {
  data: () => {
    return { name: 'world' }
  }
}
</script>
```

And then run:
```bash
npm start
```

Go to [http://localhost:3000](http://localhost:3000)

So far, we get:

- Automatic transpilation and bundling (with webpack and babel)
- Hot code reloading
- Server rendering and indexing of `./pages`
- Static file serving. `./static/` is mapped to `/static/`
- Config file `nuxt.config.js`
- Code splitting via webpack

## Using nuxt.js programmatically

Nuxt is built on the top of ES2015, which makes the code more enjoyable and cleaner to read. It doesn't make use of any transpilers and depends upon Core V8 implemented features.
For these reasons, Nuxt.js targets Node.js `4.0` or higher (you might want to launch node with the `--harmony-proxies` flag if you running `node <= 6.5.0` )

```js
const Nuxt = require('nuxt')

const options = {
  routes: [], // see examples/custom-routes
  css: ['/dist/boostrap.css'] // see examples/global-css
  store: true // see examples/vuex-store
  vendor: ['axios'], // see examples/plugins-vendor
  plugins: ['public/plugin.js'], // see examples/plugins-vendor
  loading: false or { color: 'blue', failedColor: 'red' } or 'components/my-loader' // see examples/custom-loading
}

// Launch nuxt build with given options
new Nuxt(options)
.then((nuxt) => {
  // You can use nuxt.render(req, res) or nuxt.renderRoute(route, context)
})
.catch((error) {
  // If an error appended while building the project
})
```


## Using nuxt.js as a middleware

You might want to use your own server with you configurations, your API and everything awesome your created with. That's why you can use nuxt.js as a middleware. It's recommended to use it at the end of your middlewares since it will handle the rendering of your web application and won't call next()

```js
app.use(nuxt.render)
```

## Render a specific route

This is mostly used for tests purpose but who knows!

```js
nuxt.renderRoute('/about', context)
.then(function (html) {
  // HTML
})
.catch(function (error) {
  // And error appended while rendering the route
})
```

## Examples

Please take a look at the examples/ folder.
If you want to launch one example to see it live:

```bash
cd node_modules/nuxt/
bin/nuxt examples/hello-world
# Go to http://localhost:3000
```
