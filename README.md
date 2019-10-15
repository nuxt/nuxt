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
  <a href="#platinium-sponsors" alt="Platinium Sponsors on Open Collective"><img src="https://opencollective.com/nuxtjs/tiers/platinium-sponsors/badge.svg" /></a>
  <a href="#gold-sponsors" alt="Gold Sponsors on Open Collective"><img src="https://opencollective.com/nuxtjs/tiers/gold-sponsors/badge.svg" /></a>
  <a href="#silver-sponsors" alt="Silver Sponsors on Open Collective"><img src="https://opencollective.com/nuxtjs/tiers/silver-sponsors/badge.svg" /></a>
  <a href="#bronze-sponsors" alt="Bronze Sponsors on Open Collective"><img src="https://opencollective.com/nuxtjs/tiers/bronze-sponsors/badge.svg" /></a>
  <a href="#nuxters" alt="Nuxters on Open Collective"><img src="https://opencollective.com/nuxtjs/tiers/nuxters/badge.svg" /></a>
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

Learn more at <https://nuxtjs.org>.

## Consulting from the Nuxt team

Get help with that tough bug or make sure your Nuxt app is ready to deploy. For $250 an hour, get technical support, advice, code reviews, and development from the Nuxt core team: [Hire Nuxt on Otechie](https://otechie.com/nuxt?ref=readme)

## Professional support with TideLift

Professionally supported Nuxt.js is now available!

Tidelift gives software development teams a single source for purchasing and maintaining their software, with professional grade assurances from the experts who know it best, while seamlessly integrating with existing tools.

[Get supported Nuxt with the Tidelift Subscription](https://tidelift.com/subscription/pkg/npm-nuxt?utm_source=npm-nuxt&utm_medium=readme).

## Supporting Nuxt.js

Nuxt.js is an MIT-licensed open source project with its ongoing development made possible entirely by the support of these awesome backers.
Funds donated via OpenCollective are managed with transparent expenses and will be used for compensating work and expenses for core team members or sponsoring community events.

Support us with a monthly donation and help us continue our activities. [[Become a backer](https://opencollective.com/nuxtjs#contribute)]

### Platinium Sponsors

[![Open Collective Platinium Sponsors][platinium-sponsors-src]][platinium-sponsors-href]

### Gold Sponsors

[![Open Collective Gold Sponsors][gold-sponsors-src]][gold-sponsors-href]

### Silver Sponsors

[![Open Collective Silver Sponsors][silver-sponsors-src]][silver-sponsors-href]

### Bronze Sponsors

[![Open Collective Bronze Sponsors][bronze-sponsors-src]][bronze-sponsors-href]

### Nuxters

[![Open Collective Nuxters][nuxters-src]][nuxters-href]

## Getting started

```sh
$ npx create-nuxt-app <project-name>
```

It's as simple as that!

## Templates

:point_right: We recommend to start directly with our cli [create-nuxt-app](https://github.com/nuxt-community/create-nuxt-app) for the latest updates.

Or you can start by using one of our starter templates:

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

Learn more: <https://nuxtjs.org/api/nuxt>

## Using nuxt.js as a middleware

You might want to use your own server with your configurations, your API and everything awesome you have created with. That's why you can use nuxt.js as a middleware. It's recommended to use it at the end of your middleware since it will handle the rendering of your web application and won't call next().

```js
app.use(nuxt.render)
```

Learn more: <https://nuxtjs.org/api/nuxt-render>

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

Learn more: <https://nuxtjs.org/api/nuxt-render-route>

## Examples

Please take a look at <https://nuxtjs.org/examples> or directly in <https://github.com/nuxt/nuxt.js/tree/dev/examples>.

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
<table><tr><td align="center"><a href="https://github.com/atinux"><img src="https://avatars2.githubusercontent.com/u/904724?v=4" width="120px;" alt="Sébastien Chopin"/><br /><sub><b>Sébastien Chopin</b></sub></a><br /><a href="#blog-Atinux" title="Blogposts">📝</a> <a href="https://github.com/Atinux/Nuxt.js/issues?q=author%3AAtinux" title="Bug reports">🐛</a> <a href="https://github.com/Atinux/Nuxt.js/commits?author=Atinux" title="Code">💻</a> <a href="#design-Atinux" title="Design">🎨</a> <a href="https://github.com/Atinux/Nuxt.js/commits?author=Atinux" title="Documentation">📖</a> <a href="#question-Atinux" title="Answering Questions">💬</a> <a href="#review-Atinux" title="Reviewed Pull Requests">👀</a> <a href="#talk-Atinux" title="Talks">📢</a></td><td align="center"><a href="https://github.com/alexchopin"><img src="https://avatars2.githubusercontent.com/u/4084277?v=4" width="120px;" alt="Alexandre Chopin"/><br /><sub><b>Alexandre Chopin</b></sub></a><br /><a href="#design-alexchopin" title="Design">🎨</a> <a href="https://github.com/Atinux/Nuxt.js/commits?author=alexchopin" title="Documentation">📖</a> <a href="#eventOrganizing-alexchopin" title="Event Organizing">📋</a> <a href="#platform-alexchopin" title="Packaging/porting to new platform">📦</a> <a href="#question-alexchopin" title="Answering Questions">💬</a> <a href="#talk-alexchopin" title="Talks">📢</a></td><td align="center"><a href="https://github.com/pi0"><img src="https://avatars0.githubusercontent.com/u/5158436?v=4" width="120px;" alt="Pooya Parsa"/><br /><sub><b>Pooya Parsa</b></sub></a><br /><a href="https://github.com/Atinux/Nuxt.js/issues?q=author%3Api0" title="Bug reports">🐛</a> <a href="https://github.com/Atinux/Nuxt.js/commits?author=pi0" title="Code">💻</a> <a href="#plugin-pi0" title="Plugin/utility libraries">🔌</a> <a href="#question-pi0" title="Answering Questions">💬</a> <a href="#review-pi0" title="Reviewed Pull Requests">👀</a> <a href="#tool-pi0" title="Tools">🔧</a></td><td align="center"><a href="https://github.com/clarkdo"><img src="https://avatars3.githubusercontent.com/u/4312154?v=4" width="120px;" alt="Clark Du"/><br /><sub><b>Clark Du</b></sub></a><br /><a href="https://github.com/Atinux/Nuxt.js/issues?q=author%3Aclarkdo" title="Bug reports">🐛</a> <a href="https://github.com/Atinux/Nuxt.js/commits?author=clarkdo" title="Code">💻</a> <a href="#example-clarkdo" title="Examples">💡</a> <a href="#review-clarkdo" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/Atinux/Nuxt.js/commits?author=clarkdo" title="Tests">⚠️</a> <a href="#tool-clarkdo" title="Tools">🔧</a></td></tr><tr><td align="center"><a href="https://github.com/manniL"><img src="https://avatars0.githubusercontent.com/u/640208?s=460&v=4" width="120px;" alt="Alexander Lichter"/><br /><sub><b>Alexander Lichter</b></sub></a><br /><a href="#question-manniL" title="Answering Questions">💬</a> <a href="https://github.com/Atinux/Nuxt.js/issues?q=author%3AmanniL" title="Bug reports">🐛</a> <a href="https://github.com/Atinux/Nuxt.js/commits?author=manniL" title="Code">💻</a> <a href="#example-manniL" title="Examples">💡</a> <a href="#review-manniL" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/Atinux/Nuxt.js/commits?author=manniL" title="Tests">⚠️</a></td><td align="center"><a href="https://github.com/galvez"><img src="https://avatars1.githubusercontent.com/u/12291?s=460&v=4" width="120px;" alt="Jonas Galvez"/><br /><sub><b>Jonas Galvez</b></sub></a><br /><a href="#question-galvez" title="Answering Questions">💬</a> <a href="https://github.com/Atinux/Nuxt.js/issues?q=author%3Agalvez" title="Bug reports">🐛</a> <a href="https://github.com/Atinux/Nuxt.js/commits?author=galvez" title="Code">💻</a> <a href="#example-galvez" title="Examples">💡</a> <a href="#review-galvez" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/Atinux/Nuxt.js/commits?author=galvez" title="Tests">⚠️</a></td><td align="center"><a href="https://github.com/aldarund"><img src="https://avatars2.githubusercontent.com/u/571159?v=4" width="120px;" alt="Dmitry Molotkov"/><br /><sub><b>Dmitry Molotkov</b></sub></a><br /><a href="#question-aldarund" title="Answering Questions">💬</a> <a href="https://github.com/Atinux/Nuxt.js/issues?q=author%3Aaldarund" title="Bug reports">🐛</a> <a href="https://github.com/Atinux/Nuxt.js/commits?author=aldarund" title="Code">💻</a> <a href="#ideas-aldarund" title="Ideas, Planning, & Feedback">🤔</a> <a href="#review-aldarund" title="Reviewed Pull Requests">👀</a></td><td align="center"><a href="https://github.com/kevinmarrec"><img src="https://avatars2.githubusercontent.com/u/25272043?v=4" width="120px;" alt="Kevin Marrec"/><br /><sub><b>Kevin Marrec</b></sub></a><br /><a href="https://github.com/Atinux/Nuxt.js/commits?author=kevinmarrec" title="Code">💻</a> <a href="#ideas-kevinmarrec" title="Ideas, Planning, & Feedback">🤔</a> <a href="#platform-kevinmarrec" title="Packaging/porting to new platform">📦</a> <a href="#review-kevinmarrec" title="Reviewed Pull Requests">👀</a></td></tr><tr><td align="center"><a href="https://github.com/pimlie"><img src="https://avatars3.githubusercontent.com/u/1067403?v=4" width="120px;" alt="Pim"/><br /><sub><b>Pim</b></sub></a><br /><a href="https://github.com/Atinux/Nuxt.js/issues?q=author%3Apimlie" title="Bug reports">🐛</a> <a href="https://github.com/Atinux/Nuxt.js/commits?author=pimlie" title="Code">💻</a></td></tr></table>

<!-- ALL-CONTRIBUTORS-LIST:END -->

## Contributors

Thank you to all our [contributors](https://github.com/nuxt/nuxt.js/graphs/contributors)!

[![Nuxt.js Contributors][contributors-src]][contributors-href]

## Contributing

Please refer to our [Contribution Guide](https://nuxtjs.org/guide/contribution-guide#codefund_ad)

## Cross-browser testing

Thanks to [BrowserStack](http://browserstack.com)!

<a href="http://browserstack.com"><img height="70" src="https://nuxtjs.org/browserstack.svg" alt="BrowserStack"></a>

## Automated testing

Thanks to [SauceLabs](https://saucelabs.com) for supporting Open Source <3

<a href="https://saucelabs.com"><img height="70" src="https://nuxtjs.org/saucelabs.svg" alt="SauceLabs"></a>

## Security

If you discover a security vulnerability regarding Nuxt.js, please send an e-mail to the team via security@nuxtjs.org! All security vulnerabilities will be promptly addressed.

## License

[MIT](https://github.com/nuxt/nuxt.js/blob/dev/LICENSE)

<!-- Open Collective Tiers -->
[platinium-sponsors-src]: https://opencollective.com/nuxtjs/tiers/platinium-sponsors.svg?avatarHeight=96&width=890
[platinium-sponsors-href]: https://opencollective.com/nuxtjs#contributors
[gold-sponsors-src]: https://opencollective.com/nuxtjs/tiers/gold-sponsors.svg?avatarHeight=80&width=890
[gold-sponsors-href]: https://opencollective.com/nuxtjs#contributors
[silver-sponsors-src]: https://opencollective.com/nuxtjs/tiers/silver-sponsors.svg?avatarHeight=64&width=890
[silver-sponsors-href]: https://opencollective.com/nuxtjs#contributors
[bronze-sponsors-src]: https://opencollective.com/nuxtjs/tiers/bronze-sponsors.svg?avatarHeight=48&width=890
[bronze-sponsors-href]: https://opencollective.com/nuxtjs#contributors
[nuxters-src]: https://opencollective.com/nuxtjs/tiers/nuxters.svg?width=890&button=false
[nuxters-href]: https://opencollective.com/nuxtjs#contributors
[contributors-src]: https://opencollective.com/nuxtjs/contributors.svg?width=890&button=false
[contributors-href]: https://github.com/nuxt/nuxt.js/graphs/contributors
