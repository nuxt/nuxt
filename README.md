<p align="center"><img align="center" src="http://imgur.com/V4LtoII.png"/></p>
<p align="center">
  <a href="https://circleci.com/gh/nuxt/nuxt.js"><img src="https://badgen.net/circleci/github/nuxt/nuxt.js/dev" alt="Build Status"></a>
  <a href="https://ci.appveyor.com/project/nuxt/nuxt-js"><img src="https://badgen.net/appveyor/ci/nuxt/nuxt-js/dev" alt="Windows Build Status"></a>
  <a href="https://codecov.io/gh/nuxt/nuxt.js"><img src="https://badgen.net/codecov/c/github/nuxt/nuxt.js/dev" alt="Coverage Status"></a>
  <a href="https://www.npmjs.com/package/nuxt"><img src="https://badgen.net/npm/dm/nuxt" alt="Downloads"></a>
  <a href="https://www.npmjs.com/package/nuxt"><img src="https://badgen.net/npm/v/nuxt" alt="Version"></a>
  <a href="https://www.npmjs.com/package/nuxt"><img src="https://badgen.net/npm/license/nuxt" alt="License"></a>
  <a href="https://discord.gg/VApZF5W"><img src="https://badgen.net/badge/Discord/join-us/7289DA" alt="Discord"></a>
 </p>
 <p align="center">
  <a href="#partners" alt="Partner on Open Collective"><img src="https://opencollective.com/nuxtjs/tiers/partner/badge.svg" /></a>
  <a href="#sponsors" alt="Sponsors on Open Collective"><img src="https://opencollective.com/nuxtjs/tiers/sponsors/badge.svg" /></a>
  <a href="#backers" alt="Backers on Open Collective"><img src="https://opencollective.com/nuxtjs/tiers/backers/badge.svg" /></a>
  <a href="https://opencollective.com/nuxtjs"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>

</p>

> Vue.js Meta Framework to create complex, fast & universal web applications *quickly*.

## Links

- 📘 Documentation: [https://nuxtjs.org](https://nuxtjs.org)
- 👥 Community: [cmty.app/nuxt](https://cmty.app/nuxt)
- 🎬 Video: [1 minute demo](https://www.youtube.com/watch?v=kmf-p-pTi40)
- 🐦 Twitter: [@nuxt_js](https://twitter.com/nuxt_js)
- 💬 Chat: [Discord](https://discord.gg/VApZF5W)
- 📦 [Nuxt.js Modules](https://github.com/nuxt-community/modules)
- 👉 [Play with Nuxt.js online](https://glitch.com/edit/#!/nuxt-hello-world)

## Features

- Automatic transpilation and bundling (with webpack and babel)
- Hot code reloading
- Server-side rendering OR Single Page App OR Static Generated, you choose :fire:
- Static file serving. `./static/` is mapped to `/`
- Configurable with a `nuxt.config.js` file
- Custom layouts with the `layouts/` directory
- Middleware
- Code splitting for every `pages/`

Learn more at [nuxtjs.org](https://nuxtjs.org).

## Professional support with TideLift

Professionally supported Nuxt.js is now available!

Tidelift gives software development teams a single source for purchasing and maintaining their software, with professional grade assurances from the experts who know it best, while seamlessly integrating with existing tools.

[Get supported Nuxt with the Tidelift Subscription](https://tidelift.com/subscription/pkg/npm-nuxt?utm_source=npm-nuxt&utm_medium=readme).

## Partners

Become a partner and get your logo on our README on GitHub and every page of https://nuxtjs.org website with a link to your site. [[Become a partner](https://opencollective.com/nuxtjs#partner)]

<a href="https://opencollective.com/nuxtjs#contributors"><img src="https://opencollective.com/nuxtjs/tiers/partner.svg?avatarHeight=96&width=890&button=false" /></a>

## Sponsors

Become a sponsor and get your logo on our README on GitHub with a link to your site. [[Become a sponsor](https://opencollective.com/nuxtjs#sponsor)]

<a href="https://opencollective.com/nuxtjs#contributors"><img src="https://opencollective.com/nuxtjs/tiers/sponsors.svg?avatarHeight=72&width=890&button=false" /></a>

## Backers

Support us with a monthly donation and help us continue our activities. [[Become a backer](https://opencollective.com/nuxtjs#backer)]

<a href="https://opencollective.com/nuxtjs#contributors"><img src="https://opencollective.com/nuxtjs/tiers/backers.svg?width=890&button=false" /></a>

## Getting started

```
$ npm install nuxt
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

## Templates

:point_right: We recommend to start directly with our cli [create-nuxt-app](https://github.com/nuxt-community/create-nuxt-app) for the latest updates.

Or you can start by using one of our starter templates:
- [starter](https://github.com/nuxt-community/starter-template): Basic Nuxt.js project template
- [express](https://github.com/nuxt-community/express-template): Nuxt.js + Express
- [koa](https://github.com/nuxt-community/koa-template): Nuxt.js + Koa
- [adonuxt](https://github.com/nuxt-community/adonuxt-template): Nuxt.js + AdonisJS
- [micro](https://github.com/nuxt-community/micro-template): Nuxt.js + Micro
- [nuxtent](https://github.com/nuxt-community/nuxtent-template): Nuxt.js + Nuxtent module for content heavy sites

## Using nuxt.js programmatically

```js
const { Nuxt, Builder } = require('nuxt')

// Import and set nuxt.js options
let config = require('./nuxt.config.js')
config.dev = (process.env.NODE_ENV !== 'production')

let nuxt = new Nuxt(config)

// Start build process (only in development)
if (config.dev) {
  new Builder(nuxt).build()
}

// You can use nuxt.render(req, res) or nuxt.renderRoute(route, context)
```

Learn more: https://nuxtjs.org/api/nuxt

## Using nuxt.js as a middleware

You might want to use your own server with your configurations, your API and everything awesome your created with. That's why you can use nuxt.js as a middleware. It's recommended to use it at the end of your middleware since it will handle the rendering of your web application and won't call next().

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

Please take a look at https://nuxtjs.org/examples or directly in https://github.com/nuxt/nuxt.js/tree/dev/examples.

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

## Core team

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore -->
| [<img src="https://avatars2.githubusercontent.com/u/904724?v=4" width="150px;"/><br /><sub><b>Sébastien Chopin</b></sub>](https://github.com/atinux)<br />[📝](#blog-Atinux "Blogposts") [🐛](https://github.com/Atinux/Nuxt.js/issues?q=author%3AAtinux "Bug reports") [💻](https://github.com/Atinux/Nuxt.js/commits?author=Atinux "Code") [🎨](#design-Atinux "Design") [📖](https://github.com/Atinux/Nuxt.js/commits?author=Atinux "Documentation") [💬](#question-Atinux "Answering Questions") [👀](#review-Atinux "Reviewed Pull Requests") [📢](#talk-Atinux "Talks") | [<img src="https://avatars2.githubusercontent.com/u/4084277?v=4" width="150px;"/><br /><sub><b>Alexandre Chopin</b></sub>](https://github.com/alexchopin)<br />[🎨](#design-alexchopin "Design") [📖](https://github.com/Atinux/Nuxt.js/commits?author=alexchopin "Documentation") [📋](#eventOrganizing-alexchopin "Event Organizing") [📦](#platform-alexchopin "Packaging/porting to new platform") [💬](#question-alexchopin "Answering Questions") [📢](#talk-alexchopin "Talks") | [<img src="https://avatars0.githubusercontent.com/u/5158436?v=4" width="150px;"/><br /><sub><b>Pooya Parsa</b></sub>](https://github.com/pi0)<br />[🐛](https://github.com/Atinux/Nuxt.js/issues?q=author%3Api0 "Bug reports") [💻](https://github.com/Atinux/Nuxt.js/commits?author=pi0 "Code") [🔌](#plugin-pi0 "Plugin/utility libraries") [💬](#question-pi0 "Answering Questions") [👀](#review-pi0 "Reviewed Pull Requests") [🔧](#tool-pi0 "Tools") | [<img src="https://avatars3.githubusercontent.com/u/4312154?v=4" width="150px;"/><br /><sub><b>Clark Du</b></sub>](https://github.com/clarkdo)<br />[🐛](https://github.com/Atinux/Nuxt.js/issues?q=author%3Aclarkdo "Bug reports") [💻](https://github.com/Atinux/Nuxt.js/commits?author=clarkdo "Code") [💡](#example-clarkdo "Examples") [👀](#review-clarkdo "Reviewed Pull Requests") [⚠️](https://github.com/Atinux/Nuxt.js/commits?author=clarkdo "Tests") [🔧](#tool-clarkdo "Tools") |
| :---: | :---: | :---: | :---: |
<!-- ALL-CONTRIBUTORS-LIST:END -->

## Contributors

Thank you to all our [contributors](https://github.com/nuxt/nuxt.js/graphs/contributors)!

<a href="https://github.com/nuxt/nuxt.js/graphs/contributors"><img src="https://opencollective.com/nuxtjs/contributors.svg?width=890&button=false" /></a>

## Contributing

Please see our [CONTRIBUTING.md](./CONTRIBUTING.md)

## Cross-browser testing

Thanks to BrowserStack!

<a href="http://browserstack.com"><img height="70" src="https://p3.zdusercontent.com/attachment/1015988/PWfFdN71Aung2evRkIVQuKJpE?token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..aUrNFb8clSXsFwgw5BUTcg.IJr5piuCen7PmSSBHSrOnqM9K5YZfxX3lvbp-5LCqoKOi4CjjgdA419iqjofs0nLtm26FMURvZ8JRTuKB4iHer6lGu5f8dXHtIkYAHjP5fXDWkl044Yg2mSdrhF6uPy62GdlBYoYxwvgkNrac8nN_In8GY-qOC7bYmlZyJT7tsTZUTYbNMQiXS86YA5LgdCEWzWreMvc3C6cvZtVXIrcVgpkroIhvsTQPm4vQA-Uq6iCbTPA4oX5cpEtMtrlg4jYBnnAE4BTw5UwU_dY83ep5g.7wpc1IKv0rSRGsvqCG_q3g" alt="BrowserStack"></a>

## License

[MIT](https://github.com/nuxt/nuxt.js/blob/dev/LICENSE)
