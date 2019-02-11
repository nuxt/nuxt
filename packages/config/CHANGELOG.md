# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.4.3](https://github.com/nuxt/nuxt.js/compare/v2.4.2...v2.4.3) (2019-02-06)

**Note:** Version bump only for package @nuxt/config





## [2.4.2](https://github.com/nuxt/nuxt.js/compare/v2.4.1...v2.4.2) (2019-01-30)

**Note:** Version bump only for package @nuxt/config





## [2.4.1](https://github.com/nuxt/nuxt.js/compare/v2.4.0...v2.4.1) (2019-01-30)

**Note:** Version bump only for package @nuxt/config





# [2.4.0](https://github.com/nuxt/nuxt.js/compare/v2.3.4...v2.4.0) (2019-01-28)


### Bug Fixes

* add option to rewatch on path after raw fs event ([#4717](https://github.com/nuxt/nuxt.js/issues/4717)) ([9c6df49](https://github.com/nuxt/nuxt.js/commit/9c6df49))
* fall back to default value when `publicPath` is falsy ([#4365](https://github.com/nuxt/nuxt.js/issues/4365)) ([e0537d5](https://github.com/nuxt/nuxt.js/commit/e0537d5))
* improvements for build and dev stability ([#4470](https://github.com/nuxt/nuxt.js/issues/4470)) ([fe05169](https://github.com/nuxt/nuxt.js/commit/fe05169))
* replace nuxtDir with module.paths ([#4448](https://github.com/nuxt/nuxt.js/issues/4448)) ([d66e1ec](https://github.com/nuxt/nuxt.js/commit/d66e1ec))
* **config:** define once default nuxt config filename ([#4814](https://github.com/nuxt/nuxt.js/issues/4814)) ([06a18ca](https://github.com/nuxt/nuxt.js/commit/06a18ca))
* **deps:** update all non-major dependencies ([#4358](https://github.com/nuxt/nuxt.js/issues/4358)) ([45fdae0](https://github.com/nuxt/nuxt.js/commit/45fdae0))
* **test:** remove local paths ([d02eb2f](https://github.com/nuxt/nuxt.js/commit/d02eb2f))
* **ts:** switch from babel preset to ts-loader ([#4563](https://github.com/nuxt/nuxt.js/issues/4563)) ([75e3df6](https://github.com/nuxt/nuxt.js/commit/75e3df6))


### Features

* **builder:** optional typescript support ([#4557](https://github.com/nuxt/nuxt.js/issues/4557)) ([7145c1a](https://github.com/nuxt/nuxt.js/commit/7145c1a))
* **builder:** validate vue-app dependencies and suggest fix ([#4669](https://github.com/nuxt/nuxt.js/issues/4669)) ([7dd33fe](https://github.com/nuxt/nuxt.js/commit/7dd33fe))
* **modern:** auto detect modern mode ([#4422](https://github.com/nuxt/nuxt.js/issues/4422)) ([fe492d8](https://github.com/nuxt/nuxt.js/commit/fe492d8))
* **nuxt-link:** Smart prefetching and $nuxt.isOffline ([#4574](https://github.com/nuxt/nuxt.js/issues/4574)) ([f319033](https://github.com/nuxt/nuxt.js/commit/f319033))
* **router:** custom route name splitter ([#4598](https://github.com/nuxt/nuxt.js/issues/4598)) ([add8000](https://github.com/nuxt/nuxt.js/commit/add8000))
* **server:** timing option for `Server-Timing` header ([#4800](https://github.com/nuxt/nuxt.js/issues/4800)) ([b23f5c9](https://github.com/nuxt/nuxt.js/commit/b23f5c9))
* **test:** unit tests for core/config module ([#4760](https://github.com/nuxt/nuxt.js/issues/4760)) ([a616c09](https://github.com/nuxt/nuxt.js/commit/a616c09))
* **ts:** add TSX support ([#4613](https://github.com/nuxt/nuxt.js/issues/4613)) ([4d52742](https://github.com/nuxt/nuxt.js/commit/4d52742))
* attach ts-loader options on build.loaders.ts ([#4572](https://github.com/nuxt/nuxt.js/issues/4572)) ([d723e49](https://github.com/nuxt/nuxt.js/commit/d723e49))
* **ts:** provide type checking through `fork-ts-checker-webpack-plugin` ([#4611](https://github.com/nuxt/nuxt.js/issues/4611)) ([f1377a7](https://github.com/nuxt/nuxt.js/commit/f1377a7))
* add an option to disable FriendlyErrorsWebpackPlugin ([#4498](https://github.com/nuxt/nuxt.js/issues/4498)) ([f1b2ca3](https://github.com/nuxt/nuxt.js/commit/f1b2ca3))
* **webpack:** add experimental HardSourceWebpackPlugin support ([#4527](https://github.com/nuxt/nuxt.js/issues/4527)) ([c6d820a](https://github.com/nuxt/nuxt.js/commit/c6d820a))
* add exclude regex array for generated pages ([#4754](https://github.com/nuxt/nuxt.js/issues/4754)) ([ec17804](https://github.com/nuxt/nuxt.js/commit/ec17804))
* add styleExtensions ([#4671](https://github.com/nuxt/nuxt.js/issues/4671)) ([471a32a](https://github.com/nuxt/nuxt.js/commit/471a32a))
* **webpack,cli:** standalone build mode ([#4661](https://github.com/nuxt/nuxt.js/issues/4661)) ([bdb6791](https://github.com/nuxt/nuxt.js/commit/bdb6791))
* nuxt-ts ([#4658](https://github.com/nuxt/nuxt.js/issues/4658)) ([ee0096b](https://github.com/nuxt/nuxt.js/commit/ee0096b))
* use runInNewContext: true for nuxt dev ([#4508](https://github.com/nuxt/nuxt.js/issues/4508)) ([1162f2d](https://github.com/nuxt/nuxt.js/commit/1162f2d))


### Performance Improvements

* **pkg:** remove lodash dependency from packages ([#4411](https://github.com/nuxt/nuxt.js/issues/4411)) ([d7851b3](https://github.com/nuxt/nuxt.js/commit/d7851b3))





## [2.3.4](https://github.com/nuxt/nuxt.js/compare/v2.3.2...v2.3.4) (2018-11-26)


### Performance Improvements

* **pkg:** remove lodash dependency from packages ([#4411](https://github.com/nuxt/nuxt.js/issues/4411)) ([7e1beed](https://github.com/nuxt/nuxt.js/commit/7e1beed))
