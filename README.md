<p align="center"><img align="center" src="http://imgur.com/V4LtoII.png"/></p>
<p align="center">
  <a href="https://travis-ci.org/nuxt/nuxt.js"><img src="https://img.shields.io/travis/nuxt/nuxt.js/master.svg" alt="Build Status"></a>
  <a href="https://ci.appveyor.com/project/Atinux/nuxt-js"><img src="https://ci.appveyor.com/api/projects/status/gwab06obc6srx9g4?svg=true" alt="Windows Build Status"></a>
  <a href="https://codecov.io/gh/nuxt/nuxt.js"><img src="https://img.shields.io/codecov/c/github/nuxt/nuxt.js/master.svg" alt="Coverage Status"></a>
  <a href="https://www.npmjs.com/package/nuxt"><img src="https://img.shields.io/npm/dt/nuxt.svg" alt="Downloads"></a>
  <a href="https://www.npmjs.com/package/nuxt"><img src="https://img.shields.io/npm/v/nuxt.svg" alt="Version"></a>
  <a href="https://www.npmjs.com/package/nuxt"><img src="https://img.shields.io/npm/l/nuxt.svg" alt="License"></a>
  <a href="https://gitter.im/nuxt/nuxt.js"><img src="https://img.shields.io/badge/GITTER-join%20chat-green.svg" alt="Gitter"></a>
  <a href="https://donorbox.org/nuxt"><img src="https://img.shields.io/badge/Support%20us-donate-41B883.svg" alt="Support us"></a>
  
</p>

> Nuxt.js is a framework for server-rendered Vue applications (inspired by [Next.js](https://github.com/zeit/next.js))

## 🚧 Under active development, [1.0](https://github.com/nuxt/nuxt.js/projects/1) will be released soon :fire:

## Links

- 📘 Documentation: [https://nuxtjs.org](https://nuxtjs.org)
- 🎬 Video: [1 minute demo](https://www.youtube.com/watch?v=kmf-p-pTi40)
- 🐦 Twitter: [@nuxt_js](https://twitter.com/nuxt_js)
- 👉 [Play with Nuxt.js online](https://glitch.com/edit/#!/nuxt-hello-world)

## Getting started

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
- Server rendering and indexing of `pages/`
- Static file serving. `./static/` is mapped to `/`
- Configurable with a `nuxt.config.js` file
- Custom layouts with the `layouts/` directory
- Middleware
- Code splitting via webpack

Learn more at [nuxtjs.org](https://nuxtjs.org).

## Templates

You can start by using one of our starter templates:
- [starter](https://github.com/nuxt/starter): Basic Nuxt.js project template
- [express](https://github.com/nuxt/express): Nuxt.js + Express
- [koa](https://github.com/nuxt/koa): Nuxt.js + Koa
- [adonuxt](https://github.com/nuxt/adonuxt): Nuxt.js + AdonisJS

## Using nuxt.js programmatically

```js
const Nuxt = require('nuxt')

// Launch nuxt build with given options
let config = require('./nuxt.config.js')
let nuxt = new Nuxt(config)
nuxt.build()
.then(() => {
  // You can use nuxt.render(req, res) or nuxt.renderRoute(route, context)
})
.catch((e) => {
  // An error happened during the build
})
```

Learn more: https://nuxtjs.org/api/nuxt

## Using nuxt.js as a middleware

You might want to use your own server with you configurations, your API and everything awesome your created with. That's why you can use nuxt.js as a middleware. It's recommended to use it at the end of your middleware since it will handle the rendering of your web application and won't call next().

```js
app.use(nuxt.render)
```

Learn more: https://nuxtjs.org/api/nuxt-render

## Render a specific route

This is mostly used for `nuxt generate` and test purposes but you might find another utility!

```js
nuxt.renderRoute('/about', context)
.then(function ({ html, error }) {
  // You can check error to know if your app displayed the error page for this route
  // Useful to set the correct status code if an error appended:
  if (error) {
    return res.status(error.statusCode || 500).send(html)
  }
  res.send(html)
})
.catch(function (error) {
  // And error appended while rendering the route
})
```

Learn more: https://nuxtjs.org/api/nuxt-render-route

## Examples

Please take a look at https://nuxtjs.org/examples

## Production deployment

To deploy, instead of running nuxt, you probably want to build ahead of time. Therefore, building and starting are separate commands:

```bash
nuxt build
nuxt start
```

For example, to deploy with [`now`](https://zeit.co/now) a `package.json` like follows is recommended:
```json
{
  "name": "my-app",
  "dependencies": {
    "nuxt": "latest"
  },
  "scripts": {
    "dev": "nuxt",
    "build": "nuxt build",
    "start": "nuxt start"
  }
}
```
Then run `now` and enjoy!

Note: we recommend putting `.nuxt` in `.npmignore` or `.gitignore`.

## Roadmap

https://github.com/nuxt/nuxt.js/projects/1

## Donate

Feel free to make a donation to support us.

<a href="https://donorbox.org/nuxt"><img src="https://img.shields.io/badge/Support%20us-donate-41B883.svg" alt="Support us"></a>
