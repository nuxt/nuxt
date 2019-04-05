# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.6.1](https://github.com/nuxt/nuxt.js/compare/v2.6.0...v2.6.1) (2019-04-04)

**Note:** Version bump only for package @nuxt/vue-app





# [2.6.0](https://github.com/nuxt/nuxt.js/compare/v2.5.1...v2.6.0) (2019-04-04)


### Bug Fixes

* **vue-app:** decode uri in `getlocation` ([#5337](https://github.com/nuxt/nuxt.js/issues/5337)) ([77dcfe6](https://github.com/nuxt/nuxt.js/commit/77dcfe6))
* **vue-app:** prevent mounting page twice on redirect ([#5361](https://github.com/nuxt/nuxt.js/issues/5361)) ([2d73e8a](https://github.com/nuxt/nuxt.js/commit/2d73e8a))
* fail in case of missing core-js dependency ([#5342](https://github.com/nuxt/nuxt.js/issues/5342)) ([439b914](https://github.com/nuxt/nuxt.js/commit/439b914))


### Features

* **babel-preset-app:** support specifying core-js version ([#5411](https://github.com/nuxt/nuxt.js/issues/5411)) ([159123f](https://github.com/nuxt/nuxt.js/commit/159123f))





## [2.5.1](https://github.com/nuxt/nuxt.js/compare/v2.5.0...v2.5.1) (2019-03-21)

**Note:** Version bump only for package @nuxt/vue-app





# [2.5.0](https://github.com/nuxt/nuxt.js/compare/v2.4.5...v2.5.0) (2019-03-21)


### Bug Fixes

* **builder, vue-app:** order of plugin execution based on order in array ([#5163](https://github.com/nuxt/nuxt.js/issues/5163)) ([a867dbd](https://github.com/nuxt/nuxt.js/commit/a867dbd))
* **ts:** deprecate `isClient`, `isServer`, `isStatic` ([#5211](https://github.com/nuxt/nuxt.js/issues/5211)) ([29c3c42](https://github.com/nuxt/nuxt.js/commit/29c3c42))
* **types:** reflect chainlable NuxtLoading methods ([#5104](https://github.com/nuxt/nuxt.js/issues/5104)) ([a6756a4](https://github.com/nuxt/nuxt.js/commit/a6756a4))
* **vua-app:** clone mount error to prevent mutating read-only error object ([#5214](https://github.com/nuxt/nuxt.js/issues/5214)) ([37006f6](https://github.com/nuxt/nuxt.js/commit/37006f6))
* **vue-app:** avoid css chunk error ([#5173](https://github.com/nuxt/nuxt.js/issues/5173)) ([41028a4](https://github.com/nuxt/nuxt.js/commit/41028a4))
* **vue-app:** decode router base to support unicode characters ([#5297](https://github.com/nuxt/nuxt.js/issues/5297)) ([3ac01df](https://github.com/nuxt/nuxt.js/commit/3ac01df))
* **vue-app:** duplicated router.base when using context.redirect(object) ([#5290](https://github.com/nuxt/nuxt.js/issues/5290)) ([cf02e82](https://github.com/nuxt/nuxt.js/commit/cf02e82))
* **vue-app:** multiple named views cause invalid syntax ([#5262](https://github.com/nuxt/nuxt.js/issues/5262)) ([d03a61b](https://github.com/nuxt/nuxt.js/commit/d03a61b))
* keep-alive component data should not be updated ([#5188](https://github.com/nuxt/nuxt.js/issues/5188)) ([1ea8661](https://github.com/nuxt/nuxt.js/commit/1ea8661))
* respect namespaced in store module ([#5189](https://github.com/nuxt/nuxt.js/issues/5189)) ([9e1ef88](https://github.com/nuxt/nuxt.js/commit/9e1ef88))
* **vue-app:** use browser to handle scrolling position on page reload and back-navigation from other sites ([#5080](https://github.com/nuxt/nuxt.js/issues/5080)) ([ee87f4c](https://github.com/nuxt/nuxt.js/commit/ee87f4c))


### Features

* loading screen ([#5251](https://github.com/nuxt/nuxt.js/issues/5251)) ([ef41e20](https://github.com/nuxt/nuxt.js/commit/ef41e20))
* **ts:** nuxt configuration typedefs ([#4854](https://github.com/nuxt/nuxt.js/issues/4854)) ([92f81e0](https://github.com/nuxt/nuxt.js/commit/92f81e0))
* **vue-app:** universal fetch ([#5028](https://github.com/nuxt/nuxt.js/issues/5028)) ([2015140](https://github.com/nuxt/nuxt.js/commit/2015140))
* **vue-renderer:** improvements ([#4722](https://github.com/nuxt/nuxt.js/issues/4722)) ([2929716](https://github.com/nuxt/nuxt.js/commit/2929716))
* .nuxtignore ([#4647](https://github.com/nuxt/nuxt.js/issues/4647)) ([59be77a](https://github.com/nuxt/nuxt.js/commit/59be77a))
* upgrade vue to 2.6 ([#4953](https://github.com/nuxt/nuxt.js/issues/4953)) ([9308954](https://github.com/nuxt/nuxt.js/commit/9308954))


### Performance Improvements

* await routeData promises in parallel ([#5027](https://github.com/nuxt/nuxt.js/issues/5027)) ([0826d7e](https://github.com/nuxt/nuxt.js/commit/0826d7e))





## [2.4.4](https://github.com/nuxt/nuxt.js/compare/v2.4.3...v2.4.4) (2019-02-26)


### Bug Fixes

* **types:** reflect chainlable NuxtLoading methods ([#5104](https://github.com/nuxt/nuxt.js/issues/5104)) ([66273f4](https://github.com/nuxt/nuxt.js/commit/66273f4))
* **vue-app:** fix `asyncData` memory leak on client-side ([#4966](https://github.com/nuxt/nuxt.js/issues/4966)) ([4086800](https://github.com/nuxt/nuxt.js/commit/4086800))
* **vue-app:** fix `getNuxtChildComponents` method ([#4969](https://github.com/nuxt/nuxt.js/issues/4969)) ([dbf7099](https://github.com/nuxt/nuxt.js/commit/dbf7099))
* **vue-app:** use browser to handle scrolling position on page reload and back-navigation from other sites ([#5080](https://github.com/nuxt/nuxt.js/issues/5080)) ([7001312](https://github.com/nuxt/nuxt.js/commit/7001312))





## [2.4.2](https://github.com/nuxt/nuxt.js/compare/v2.4.1...v2.4.2) (2019-01-30)

**Note:** Version bump only for package @nuxt/vue-app





## [2.4.1](https://github.com/nuxt/nuxt.js/compare/v2.4.0...v2.4.1) (2019-01-30)

**Note:** Version bump only for package @nuxt/vue-app





# [2.4.0](https://github.com/nuxt/nuxt.js/compare/v2.3.4...v2.4.0) (2019-01-28)


### Bug Fixes

* $nuxt is used instead of globalName ([#4743](https://github.com/nuxt/nuxt.js/issues/4743)) ([fe57a5a](https://github.com/nuxt/nuxt.js/commit/fe57a5a))
* allow keepAliveProps for nuxt component ([#4610](https://github.com/nuxt/nuxt.js/issues/4610)) ([8dc15d0](https://github.com/nuxt/nuxt.js/commit/8dc15d0))
* apply store HMR to whole store ([#4589](https://github.com/nuxt/nuxt.js/issues/4589)) ([81cf09c](https://github.com/nuxt/nuxt.js/commit/81cf09c))
* hotfix for vuex hmr ([#4801](https://github.com/nuxt/nuxt.js/issues/4801)) ([5f0b34f](https://github.com/nuxt/nuxt.js/commit/5f0b34f))
* keepAliveProps broken in <nuxt-child> ([#4521](https://github.com/nuxt/nuxt.js/issues/4521)) ([431cc15](https://github.com/nuxt/nuxt.js/commit/431cc15))
* loading.throttle can not be 0 ([2d74804](https://github.com/nuxt/nuxt.js/commit/2d74804))
* merge route.meta into options.meta ([#4479](https://github.com/nuxt/nuxt.js/issues/4479)) ([5a8e6e4](https://github.com/nuxt/nuxt.js/commit/5a8e6e4))
* properly serialize head functions ([#4558](https://github.com/nuxt/nuxt.js/issues/4558)) ([7831e57](https://github.com/nuxt/nuxt.js/commit/7831e57)), closes [#4079](https://github.com/nuxt/nuxt.js/issues/4079)
* **vue-app:** Set window. equals to window.{globalName} when defined ([951e745](https://github.com/nuxt/nuxt.js/commit/951e745))
* remove unnecessary isDev in template/server ([a51ba8d](https://github.com/nuxt/nuxt.js/commit/a51ba8d))
* **vue-app:** Fix Vuex HMR & refactor for better modules usage ([#4791](https://github.com/nuxt/nuxt.js/issues/4791)) ([deadc48](https://github.com/nuxt/nuxt.js/commit/deadc48))
* router Expected "0" to be defined ([#4394](https://github.com/nuxt/nuxt.js/issues/4394)) ([39b1b8e](https://github.com/nuxt/nuxt.js/commit/39b1b8e))
* **vue-app:** Fix route meta to handle order ([45be638](https://github.com/nuxt/nuxt.js/commit/45be638))
* use triple equals in loading.throttle [release] ([e77c2db](https://github.com/nuxt/nuxt.js/commit/e77c2db))
* Vue.component(RouterLink) is undefined in vue-router 3.0.0 ([#4668](https://github.com/nuxt/nuxt.js/issues/4668)) ([7ff4058](https://github.com/nuxt/nuxt.js/commit/7ff4058))
* **ts:** fix missing process type definitions and refactor types tests ([#4798](https://github.com/nuxt/nuxt.js/issues/4798)) ([45afc3f](https://github.com/nuxt/nuxt.js/commit/45afc3f))
* wrong type checking for loading.duration ([0c15b29](https://github.com/nuxt/nuxt.js/commit/0c15b29))
* **layout-middleware:** Fix issue [#4724](https://github.com/nuxt/nuxt.js/issues/4724) ([521ac20](https://github.com/nuxt/nuxt.js/commit/521ac20))
* **progress-bar:** allow 0 for values and remove duplicate defaults ([#4397](https://github.com/nuxt/nuxt.js/issues/4397)) ([ecdc7bc](https://github.com/nuxt/nuxt.js/commit/ecdc7bc))
* **scrollBehavior:** emit triggerScroll event after changing layer ([#4399](https://github.com/nuxt/nuxt.js/issues/4399)) ([330301c](https://github.com/nuxt/nuxt.js/commit/330301c)), closes [#4080](https://github.com/nuxt/nuxt.js/issues/4080)
* **server, vue-app:** allow unicode page names ([#4402](https://github.com/nuxt/nuxt.js/issues/4402)) ([949785f](https://github.com/nuxt/nuxt.js/commit/949785f))
* **ts:** Add missing `loading` property to Component options ([#4786](https://github.com/nuxt/nuxt.js/issues/4786)) ([db4001d](https://github.com/nuxt/nuxt.js/commit/db4001d))
* **ts:** fix `$nuxt.$loading` typedefs ([#4778](https://github.com/nuxt/nuxt.js/issues/4778)) ([6694cf7](https://github.com/nuxt/nuxt.js/commit/6694cf7))
* **vue-app:** add type definition for `ComponentOptions.middleware` ([#4531](https://github.com/nuxt/nuxt.js/issues/4531)) ([da0a379](https://github.com/nuxt/nuxt.js/commit/da0a379))
* **vue-app:** allow passing custom props to error function ([#4462](https://github.com/nuxt/nuxt.js/issues/4462)) ([a6fed0a](https://github.com/nuxt/nuxt.js/commit/a6fed0a)), closes [#4460](https://github.com/nuxt/nuxt.js/issues/4460)
* **vue-app:** Call Vue.config.errorHandler instead of simply logging the error ([6c4280f](https://github.com/nuxt/nuxt.js/commit/6c4280f))
* **vue-app:** Fix default error handler in production ([96892c5](https://github.com/nuxt/nuxt.js/commit/96892c5))
* **vue-app:** router.meta is null on extendRoutes([#4478](https://github.com/nuxt/nuxt.js/issues/4478)) ([e2ab1b4](https://github.com/nuxt/nuxt.js/commit/e2ab1b4)), closes [#4154](https://github.com/nuxt/nuxt.js/issues/4154)


### Features

* **builder:** validate vue-app dependencies and suggest fix ([#4669](https://github.com/nuxt/nuxt.js/issues/4669)) ([7dd33fe](https://github.com/nuxt/nuxt.js/commit/7dd33fe))
* **nuxt-link:** Smart prefetching and $nuxt.isOffline ([#4574](https://github.com/nuxt/nuxt.js/issues/4574)) ([f319033](https://github.com/nuxt/nuxt.js/commit/f319033))
* **ts:** provide type definitions ([#4164](https://github.com/nuxt/nuxt.js/issues/4164)) ([d5716eb](https://github.com/nuxt/nuxt.js/commit/d5716eb))
* **ts:** typescript examples + improve `vue-app` typings ([#4695](https://github.com/nuxt/nuxt.js/issues/4695)) ([b38e0aa](https://github.com/nuxt/nuxt.js/commit/b38e0aa))
* **vue-app:** <n-link> and <n-child> component aliases ([#4525](https://github.com/nuxt/nuxt.js/issues/4525)) ([1505197](https://github.com/nuxt/nuxt.js/commit/1505197))
* **vue-app:** Add deprecating for classic mode and handle mutations/actions HMR to store/index.js ([c8b920a](https://github.com/nuxt/nuxt.js/commit/c8b920a))
* add store module HMR ([#4582](https://github.com/nuxt/nuxt.js/issues/4582)) ([b2eee17](https://github.com/nuxt/nuxt.js/commit/b2eee17))
* **vue-app:** add vetur helpers for components auto-complete on VS Code ([#4524](https://github.com/nuxt/nuxt.js/issues/4524)) ([59aee74](https://github.com/nuxt/nuxt.js/commit/59aee74))
* **vue-app:** support named views ([#4410](https://github.com/nuxt/nuxt.js/issues/4410)) ([b1b9e0b](https://github.com/nuxt/nuxt.js/commit/b1b9e0b))
* **vue-app, vue-renderer:** support meta `headAttrs` ([#4536](https://github.com/nuxt/nuxt.js/issues/4536)) ([9961453](https://github.com/nuxt/nuxt.js/commit/9961453))
* add styleExtensions ([#4671](https://github.com/nuxt/nuxt.js/issues/4671)) ([471a32a](https://github.com/nuxt/nuxt.js/commit/471a32a))
* allow scrollToTop to be explicitly disabled ([#4564](https://github.com/nuxt/nuxt.js/issues/4564)) ([669fecc](https://github.com/nuxt/nuxt.js/commit/669fecc))
* better stack traces for SSR error, show error with correct URL and use eventsource-polyfill ([#4600](https://github.com/nuxt/nuxt.js/issues/4600)) ([498c4f1](https://github.com/nuxt/nuxt.js/commit/498c4f1))
* improve SSR bundle ([#4439](https://github.com/nuxt/nuxt.js/issues/4439)) ([0f104aa](https://github.com/nuxt/nuxt.js/commit/0f104aa)), closes [#4225](https://github.com/nuxt/nuxt.js/issues/4225) [#3465](https://github.com/nuxt/nuxt.js/issues/3465) [#1728](https://github.com/nuxt/nuxt.js/issues/1728) [#1601](https://github.com/nuxt/nuxt.js/issues/1601) [#1481](https://github.com/nuxt/nuxt.js/issues/1481)
* mode for plugins ([#4592](https://github.com/nuxt/nuxt.js/issues/4592)) ([e71c455](https://github.com/nuxt/nuxt.js/commit/e71c455))


### Performance Improvements

* **ssr:** remove extra imprts from server.js ([6178c47](https://github.com/nuxt/nuxt.js/commit/6178c47))





## [2.3.4](https://github.com/nuxt/nuxt.js/compare/v2.3.2...v2.3.4) (2018-11-26)


### Bug Fixes

* **progress-bar:** allow 0 for values and remove duplicate defaults ([#4397](https://github.com/nuxt/nuxt.js/issues/4397)) ([8030ca1](https://github.com/nuxt/nuxt.js/commit/8030ca1))
* **scrollBehavior:** emit triggerScroll event after changing layer ([#4399](https://github.com/nuxt/nuxt.js/issues/4399)) ([0c6c69b](https://github.com/nuxt/nuxt.js/commit/0c6c69b)), closes [#4080](https://github.com/nuxt/nuxt.js/issues/4080)
* **server, vue-app:** allow unicode page names ([#4402](https://github.com/nuxt/nuxt.js/issues/4402)) ([d187793](https://github.com/nuxt/nuxt.js/commit/d187793))
* router Expected "0" to be defined ([#4394](https://github.com/nuxt/nuxt.js/issues/4394)) ([54d2737](https://github.com/nuxt/nuxt.js/commit/54d2737))
