<p align="center"><img align="center" style="width:320px" src="https://nuxtjs.org/meta_400.png"/></p><br/>
<p align="center">
  <a href="https://circleci.com/gh/nuxt/nuxt.js"><img src="https://badgen.net/circleci/github/nuxt/nuxt.js/dev" alt="Build Status"></a>
  <a href="https://dev.azure.com/nuxt/nuxt.js/_build/latest?definitionId=1"><img src="https://dev.azure.com/nuxt/nuxt.js/_apis/build/status/nuxt.js" alt="Azure Build Status"></a>
  <a href="https://codecov.io/gh/nuxt/nuxt.js"><img src="https://badgen.net/codecov/c/github/nuxt/nuxt.js/dev" alt="Coverage Status"></a>
  <a href="https://www.npmjs.com/package/nuxt"><img src="https://badgen.net/npm/dm/nuxt" alt="Downloads"></a>
  <a href="https://www.npmjs.com/package/nuxt"><img src="https://badgen.net/npm/v/nuxt" alt="Version"></a>
  <a href="https://www.npmjs.com/package/nuxt"><img src="https://badgen.net/npm/license/nuxt" alt="License"></a>
  <a href="https://discord.nuxtjs.org/"><img src="https://badgen.net/badge/Discord/join-us/7289DA" alt="Discord"></a>
 </p>
 <p align="center">
  <a href="#partners" alt="Partner on Open Collective"><img src="https://opencollective.com/nuxtjs/tiers/partner/badge.svg" /></a>
  <a href="#sponsors" alt="Sponsors on Open Collective"><img src="https://opencollective.com/nuxtjs/tiers/sponsors/badge.svg" /></a>
  <a href="#backers" alt="Backers on Open Collective"><img src="https://opencollective.com/nuxtjs/tiers/backers/badge.svg" /></a>
  <a href="https://oc.nuxtjs.org/"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
</p>
<p align="center">
  <a href="https://otechie.com/nuxt?ref=badge"><img src="https://api.otechie.com/consultancy/nuxt/badge.svg" alt="Hire Nuxt"></a>
</p>

> Vue.js Meta Framework to create complex, fast & universal web applications *quickly*.

## Links

- 📘 Documentation: [https://nuxtjs.org](https://nuxtjs.org)
- 👥 Community: [cmty.app/nuxt](https://cmty.app/nuxt)
- 🎬 Video: [1 minute demo](https://www.youtube.com/watch?v=kmf-p-pTi40)
- 🐦 Twitter: [@nuxt_js](https://twitter.nuxtjs.org/)
- 💬 Chat: [Discord](https://discord.nuxtjs.org/)
- 🌟 [AwesomeNuxt](https://awesome.nuxtjs.org/)
- 👉 [Play with Nuxt.js online](https://template.nuxtjs.org)

## Features

- Automatic transpilation and bundling (with webpack and babel)
- Hot code reloading
- Server-side rendering OR Single Page App OR Static Generated, you choose :fire:
- Static file serving. `./static/` is mapped to `/`
- Configurable with a `nuxt.config.js` file
- Custom layouts with the `layouts/` directory
- Middleware
- Code splitting for every `pages/`
- Loading just the critical CSS (page-level)

Learn more at [nuxtjs.org](https://nuxtjs.org).

## Consulting from the Nuxt team

Get help with that tough bug or make sure your Nuxt app is ready to deploy. For $250 an hour, get technical support, advice, code reviews, and development from the Nuxt core team: [Hire Nuxt on Otechie](https://otechie.com/nuxt?ref=readme)

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
$ npx create-nuxt-app <project-name>
```

It's as simple as that!

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
const config = require('./nuxt.config.js')
config.dev = (process.env.NODE_ENV !== 'production')

const nuxt = new Nuxt(config)

// Start build process (only in development)
if (config.dev) {
  new Builder(nuxt).build()
}

// You can use nuxt.render(req, res) or nuxt.renderRoute(route, context)
```

Learn more: https://nuxtjs.org/api/nuxt

## Using nuxt.js as a middleware

You might want to use your own server with your configurations, your API and everything awesome you have created with. That's why you can use nuxt.js as a middleware. It's recommended to use it at the end of your middleware since it will handle the rendering of your web application and won't call next().

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
| [<img src="https://avatars2.githubusercontent.com/u/904724?v=4" width="120px;"/><br /><sub><b>Sébastien Chopin</b></sub>](https://github.com/atinux)<br />[📝](#blog-Atinux "Blogposts") [🐛](https://github.com/Atinux/Nuxt.js/issues?q=author%3AAtinux "Bug reports") [💻](https://github.com/Atinux/Nuxt.js/commits?author=Atinux "Code") [🎨](#design-Atinux "Design") [📖](https://github.com/Atinux/Nuxt.js/commits?author=Atinux "Documentation") [💬](#question-Atinux "Answering Questions") [👀](#review-Atinux "Reviewed Pull Requests") [📢](#talk-Atinux "Talks") | [<img src="https://avatars2.githubusercontent.com/u/4084277?v=4" width="120px;"/><br /><sub><b>Alexandre Chopin</b></sub>](https://github.com/alexchopin)<br />[🎨](#design-alexchopin "Design") [📖](https://github.com/Atinux/Nuxt.js/commits?author=alexchopin "Documentation") [📋](#eventOrganizing-alexchopin "Event Organizing") [📦](#platform-alexchopin "Packaging/porting to new platform") [💬](#question-alexchopin "Answering Questions") [📢](#talk-alexchopin "Talks") | [<img src="https://avatars0.githubusercontent.com/u/5158436?v=4" width="120px;"/><br /><sub><b>Pooya Parsa</b></sub>](https://github.com/pi0)<br />[🐛](https://github.com/Atinux/Nuxt.js/issues?q=author%3Api0 "Bug reports") [💻](https://github.com/Atinux/Nuxt.js/commits?author=pi0 "Code") [🔌](#plugin-pi0 "Plugin/utility libraries") [💬](#question-pi0 "Answering Questions") [👀](#review-pi0 "Reviewed Pull Requests") [🔧](#tool-pi0 "Tools") | [<img src="https://avatars3.githubusercontent.com/u/4312154?v=4" width="120px;"/><br /><sub><b>Clark Du</b></sub>](https://github.com/clarkdo)<br />[🐛](https://github.com/Atinux/Nuxt.js/issues?q=author%3Aclarkdo "Bug reports") [💻](https://github.com/Atinux/Nuxt.js/commits?author=clarkdo "Code") [💡](#example-clarkdo "Examples") [👀](#review-clarkdo "Reviewed Pull Requests") [⚠️](https://github.com/Atinux/Nuxt.js/commits?author=clarkdo "Tests") [🔧](#tool-clarkdo "Tools") |
| :---: | :---: | :---: | :---: |
| [<img src="https://avatars0.githubusercontent.com/u/640208?s=460&v=4" width="120px;"/><br /><sub><b>Alexander Lichter</b></sub>](https://github.com/manniL)<br />[💬](#question-manniL "Answering Questions") [🐛](https://github.com/Atinux/Nuxt.js/issues?q=author%3AmanniL "Bug reports") [💻](https://github.com/Atinux/Nuxt.js/commits?author=manniL "Code") [💡](#example-manniL "Examples") [👀](#review-manniL "Reviewed Pull Requests") [⚠️](https://github.com/Atinux/Nuxt.js/commits?author=manniL "Tests") | [<img src="https://avatars1.githubusercontent.com/u/12291?s=460&v=4" width="120px;"/><br /><sub><b>Jonas Galvez</b></sub>](https://github.com/galvez)<br />[💬](#question-galvez "Answering Questions") [🐛](https://github.com/Atinux/Nuxt.js/issues?q=author%3Agalvez "Bug reports") [💻](https://github.com/Atinux/Nuxt.js/commits?author=galvez "Code") [💡](#example-galvez "Examples") [👀](#review-galvez "Reviewed Pull Requests") [⚠️](https://github.com/Atinux/Nuxt.js/commits?author=galvez "Tests") | [<img src="https://avatars2.githubusercontent.com/u/571159?v=4" width="120px;"/><br /><sub><b>Dmitry Molotkov</b></sub>](https://github.com/aldarund)<br />[💬](#question-aldarund "Answering Questions") [🐛](https://github.com/Atinux/Nuxt.js/issues?q=author%3Aaldarund "Bug reports") [💻](https://github.com/Atinux/Nuxt.js/commits?author=aldarund "Code") [🤔](#ideas-aldarund "Ideas, Planning, & Feedback") [👀](#review-aldarund "Reviewed Pull Requests") | [<img src="https://avatars2.githubusercontent.com/u/25272043?v=4" width="120px;"/><br /><sub><b>Kevin Marrec</b></sub>](https://github.com/kevinmarrec)<br />[💻](https://github.com/Atinux/Nuxt.js/commits?author=kevinmarrec "Code") [🤔](#ideas-kevinmarrec "Ideas, Planning, & Feedback") [📦](#platform-kevinmarrec "Packaging/porting to new platform") [👀](#review-kevinmarrec "Reviewed Pull Requests") |
<!-- ALL-CONTRIBUTORS-LIST:END -->

## Contributors

Thank you to all our [contributors](https://github.com/nuxt/nuxt.js/graphs/contributors)!

<a href="https://github.com/nuxt/nuxt.js/graphs/contributors"><img src="https://opencollective.com/nuxtjs/contributors.svg?width=890&button=false" /></a>

## Contributing

Please refer to our [Contribution Guide](https://nuxtjs.org/guide/contribution-guide#codefund_ad)

## Cross-browser testing

Thanks to BrowserStack!

<a href="http://browserstack.com"><img height="70" src="https://nuxtjs.org/browserstack.svg" alt="BrowserStack"></a>


## Security

If you discover a security vulnerability regarding Nuxt.js, please send an e-mail to the team via security@nuxtjs.org! All security vulnerabilities will be promptly addressed.

## License

[MIT](https://github.com/nuxt/nuxt.js/blob/dev/LICENSE)
