# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.6.1](https://github.com/nuxt/nuxt.js/compare/v2.6.0...v2.6.1) (2019-04-04)

**Note:** Version bump only for package @nuxt/server





# [2.6.0](https://github.com/nuxt/nuxt.js/compare/v2.5.1...v2.6.0) (2019-04-04)

**Note:** Version bump only for package @nuxt/server





## [2.5.1](https://github.com/nuxt/nuxt.js/compare/v2.5.0...v2.5.1) (2019-03-21)

**Note:** Version bump only for package @nuxt/server





# [2.5.0](https://github.com/nuxt/nuxt.js/compare/v2.4.5...v2.5.0) (2019-03-21)


### Bug Fixes

* correct socket address in use error message ([2eb1965](https://github.com/nuxt/nuxt.js/commit/2eb1965))
* **server:** handle decodeURI error ([#5243](https://github.com/nuxt/nuxt.js/issues/5243)) ([5b7f6d7](https://github.com/nuxt/nuxt.js/commit/5b7f6d7))
* await buildDone hook ([#4955](https://github.com/nuxt/nuxt.js/issues/4955)) ([5c08db2](https://github.com/nuxt/nuxt.js/commit/5c08db2))
* not send Server-Timing header if no timing info ([d9a0b5f](https://github.com/nuxt/nuxt.js/commit/d9a0b5f))
* publicPath is not reactive in dev restarting ([#5227](https://github.com/nuxt/nuxt.js/issues/5227)) ([1fb7538](https://github.com/nuxt/nuxt.js/commit/1fb7538))


### Features

* loading screen ([#5251](https://github.com/nuxt/nuxt.js/issues/5251)) ([ef41e20](https://github.com/nuxt/nuxt.js/commit/ef41e20))
* **vue-renderer:** use async fs ([#5186](https://github.com/nuxt/nuxt.js/issues/5186)) ([d07aefa](https://github.com/nuxt/nuxt.js/commit/d07aefa))





## [2.4.4](https://github.com/nuxt/nuxt.js/compare/v2.4.3...v2.4.4) (2019-02-26)


### Bug Fixes

* **deps:** update serve-placeholder and esm ([#4970](https://github.com/nuxt/nuxt.js/issues/4970)) ([111455f](https://github.com/nuxt/nuxt.js/commit/111455f))





## [2.4.3](https://github.com/nuxt/nuxt.js/compare/v2.4.2...v2.4.3) (2019-02-06)


### Bug Fixes

* await buildDone hook ([#4955](https://github.com/nuxt/nuxt.js/issues/4955)) ([f40f3f9](https://github.com/nuxt/nuxt.js/commit/f40f3f9))





## [2.4.2](https://github.com/nuxt/nuxt.js/compare/v2.4.1...v2.4.2) (2019-01-30)

**Note:** Version bump only for package @nuxt/server





## [2.4.1](https://github.com/nuxt/nuxt.js/compare/v2.4.0...v2.4.1) (2019-01-30)

**Note:** Version bump only for package @nuxt/server





# [2.4.0](https://github.com/nuxt/nuxt.js/compare/v2.3.4...v2.4.0) (2019-01-28)


### Bug Fixes

* **deps:** update all non-major dependencies ([#4358](https://github.com/nuxt/nuxt.js/issues/4358)) ([45fdae0](https://github.com/nuxt/nuxt.js/commit/45fdae0))
* **server:** allow listening on number 0 port ([#4781](https://github.com/nuxt/nuxt.js/issues/4781)) ([602cf12](https://github.com/nuxt/nuxt.js/commit/602cf12))
* **server:** allow rendering urls with unicode characters ([#4512](https://github.com/nuxt/nuxt.js/issues/4512)) ([c3128ea](https://github.com/nuxt/nuxt.js/commit/c3128ea))
* **server:** Cannot read property client of null when webpackHMR & restarting Nuxt ([8a200f7](https://github.com/nuxt/nuxt.js/commit/8a200f7))
* **server:** process browser version with non semver versions ([#4673](https://github.com/nuxt/nuxt.js/issues/4673)) ([d3b9396](https://github.com/nuxt/nuxt.js/commit/d3b9396))
* **server, jsdom:** fix timeout error message ([#4412](https://github.com/nuxt/nuxt.js/issues/4412)) ([ab6367b](https://github.com/nuxt/nuxt.js/commit/ab6367b))
* **server, vue-app:** allow unicode page names ([#4402](https://github.com/nuxt/nuxt.js/issues/4402)) ([949785f](https://github.com/nuxt/nuxt.js/commit/949785f))
* add iron browser as modern ([#4775](https://github.com/nuxt/nuxt.js/issues/4775)) ([9eab558](https://github.com/nuxt/nuxt.js/commit/9eab558))
* csp SHA hashes accumulate when using custom script-src rules ([#4519](https://github.com/nuxt/nuxt.js/issues/4519)) ([683dbba](https://github.com/nuxt/nuxt.js/commit/683dbba))
* hmr in modern mode ([#4623](https://github.com/nuxt/nuxt.js/issues/4623)) ([df9b32a](https://github.com/nuxt/nuxt.js/commit/df9b32a))
* improvements for build and dev stability ([#4470](https://github.com/nuxt/nuxt.js/issues/4470)) ([fe05169](https://github.com/nuxt/nuxt.js/commit/fe05169))
* offer a new port and listen if already used, use consola on server error ([#4428](https://github.com/nuxt/nuxt.js/issues/4428)) ([1d78027](https://github.com/nuxt/nuxt.js/commit/1d78027))
* require serverMiddleware object with path and handler ([#4656](https://github.com/nuxt/nuxt.js/issues/4656)) ([8786ff7](https://github.com/nuxt/nuxt.js/commit/8786ff7))
* wrong devMiddleware in non-modern dev mode ([3515115](https://github.com/nuxt/nuxt.js/commit/3515115))


### Features

* **modern:** auto detect modern mode ([#4422](https://github.com/nuxt/nuxt.js/issues/4422)) ([fe492d8](https://github.com/nuxt/nuxt.js/commit/fe492d8))
* **server:** export Listener ([#4577](https://github.com/nuxt/nuxt.js/issues/4577)) ([2f0ed85](https://github.com/nuxt/nuxt.js/commit/2f0ed85))
* better stack traces for SSR error, show error with correct URL and use eventsource-polyfill ([#4600](https://github.com/nuxt/nuxt.js/issues/4600)) ([498c4f1](https://github.com/nuxt/nuxt.js/commit/498c4f1))
* disable compressor if set to false/undefined ([#4381](https://github.com/nuxt/nuxt.js/issues/4381)) ([e4140ce](https://github.com/nuxt/nuxt.js/commit/e4140ce))
* improve SSR bundle ([#4439](https://github.com/nuxt/nuxt.js/issues/4439)) ([0f104aa](https://github.com/nuxt/nuxt.js/commit/0f104aa)), closes [#4225](https://github.com/nuxt/nuxt.js/issues/4225) [#3465](https://github.com/nuxt/nuxt.js/issues/3465) [#1728](https://github.com/nuxt/nuxt.js/issues/1728) [#1601](https://github.com/nuxt/nuxt.js/issues/1601) [#1481](https://github.com/nuxt/nuxt.js/issues/1481)
* nuxt-ts ([#4658](https://github.com/nuxt/nuxt.js/issues/4658)) ([ee0096b](https://github.com/nuxt/nuxt.js/commit/ee0096b))
* **server:** timing option for `Server-Timing` header ([#4800](https://github.com/nuxt/nuxt.js/issues/4800)) ([b23f5c9](https://github.com/nuxt/nuxt.js/commit/b23f5c9))





## [2.3.4](https://github.com/nuxt/nuxt.js/compare/v2.3.2...v2.3.4) (2018-11-26)


### Bug Fixes

* **server, jsdom:** fix timeout error message ([#4412](https://github.com/nuxt/nuxt.js/issues/4412)) ([e1c1240](https://github.com/nuxt/nuxt.js/commit/e1c1240))
* **server, vue-app:** allow unicode page names ([#4402](https://github.com/nuxt/nuxt.js/issues/4402)) ([d187793](https://github.com/nuxt/nuxt.js/commit/d187793))
