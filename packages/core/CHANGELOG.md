# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.6.1](https://github.com/nuxt/nuxt.js/compare/v2.6.0...v2.6.1) (2019-04-04)


### Bug Fixes

* pin esm to 3.2.20 ([#5464](https://github.com/nuxt/nuxt.js/issues/5464)) ([53915c5](https://github.com/nuxt/nuxt.js/commit/53915c5))





# [2.6.0](https://github.com/nuxt/nuxt.js/compare/v2.5.1...v2.6.0) (2019-04-04)


### Reverts

* **core:** call ready to prevent breaking changes ([#5413](https://github.com/nuxt/nuxt.js/issues/5413)) ([001ba77](https://github.com/nuxt/nuxt.js/commit/001ba77))





## [2.5.1](https://github.com/nuxt/nuxt.js/compare/v2.5.0...v2.5.1) (2019-03-21)


### Bug Fixes

* remove consola.debug for hooks ([#5318](https://github.com/nuxt/nuxt.js/issues/5318)) ([9ff01f9](https://github.com/nuxt/nuxt.js/commit/9ff01f9))





# [2.5.0](https://github.com/nuxt/nuxt.js/compare/v2.4.5...v2.5.0) (2019-03-21)


### Features

* **cli:** lock project during build or generate  ([#4985](https://github.com/nuxt/nuxt.js/issues/4985)) ([4e51723](https://github.com/nuxt/nuxt.js/commit/4e51723))
* support `devModules` option ([#5102](https://github.com/nuxt/nuxt.js/issues/5102)) ([e87711c](https://github.com/nuxt/nuxt.js/commit/e87711c))
* **module:** support src as a function in addModule ([#4956](https://github.com/nuxt/nuxt.js/issues/4956)) ([1e9eb4b](https://github.com/nuxt/nuxt.js/commit/1e9eb4b))
* **vue-renderer:** improvements ([#4722](https://github.com/nuxt/nuxt.js/issues/4722)) ([2929716](https://github.com/nuxt/nuxt.js/commit/2929716))


### Performance Improvements

* **core:** skip esm for node_modules and non .js files ([#5220](https://github.com/nuxt/nuxt.js/issues/5220)) ([aabb1f6](https://github.com/nuxt/nuxt.js/commit/aabb1f6))





## [2.4.4](https://github.com/nuxt/nuxt.js/compare/v2.4.3...v2.4.4) (2019-02-26)


### Bug Fixes

* **deps:** update serve-placeholder and esm ([#4970](https://github.com/nuxt/nuxt.js/issues/4970)) ([111455f](https://github.com/nuxt/nuxt.js/commit/111455f))





## [2.4.3](https://github.com/nuxt/nuxt.js/compare/v2.4.2...v2.4.3) (2019-02-06)


### Features

* **module:** support src as a function in addModule ([#4956](https://github.com/nuxt/nuxt.js/issues/4956)) ([e2c811a](https://github.com/nuxt/nuxt.js/commit/e2c811a))





## [2.4.2](https://github.com/nuxt/nuxt.js/compare/v2.4.1...v2.4.2) (2019-01-30)

**Note:** Version bump only for package @nuxt/core





## [2.4.1](https://github.com/nuxt/nuxt.js/compare/v2.4.0...v2.4.1) (2019-01-30)

**Note:** Version bump only for package @nuxt/core





# [2.4.0](https://github.com/nuxt/nuxt.js/compare/v2.3.4...v2.4.0) (2019-01-28)


### Bug Fixes

* improvements for build and dev stability ([#4470](https://github.com/nuxt/nuxt.js/issues/4470)) ([fe05169](https://github.com/nuxt/nuxt.js/commit/fe05169))
* **builder, module:** addLayout and nuxt.config precedence over auto-scanned layouts ([#4702](https://github.com/nuxt/nuxt.js/issues/4702)) ([f85ac94](https://github.com/nuxt/nuxt.js/commit/f85ac94))
* **deps:** update all non-major dependencies ([#4358](https://github.com/nuxt/nuxt.js/issues/4358)) ([45fdae0](https://github.com/nuxt/nuxt.js/commit/45fdae0))
* **pkg:** move opencollective dependency nuxt and nuxt-legacy ([#4415](https://github.com/nuxt/nuxt.js/issues/4415)) ([f680e36](https://github.com/nuxt/nuxt.js/commit/f680e36))
* **resolver:** resolve dir if no index found [#4568](https://github.com/nuxt/nuxt.js/issues/4568) ([#4569](https://github.com/nuxt/nuxt.js/issues/4569)) ([85b5359](https://github.com/nuxt/nuxt.js/commit/85b5359))
* **resolver:** resolvedPath/index.[ext] resolution ([#4548](https://github.com/nuxt/nuxt.js/issues/4548)) ([b413bc1](https://github.com/nuxt/nuxt.js/commit/b413bc1))
* not use deprecated option esm in resolver ([5f6361f](https://github.com/nuxt/nuxt.js/commit/5f6361f))
* wait error hook ([36ca945](https://github.com/nuxt/nuxt.js/commit/36ca945))


### Features

* add styleExtensions ([#4671](https://github.com/nuxt/nuxt.js/issues/4671)) ([471a32a](https://github.com/nuxt/nuxt.js/commit/471a32a))
* mode for plugins ([#4592](https://github.com/nuxt/nuxt.js/issues/4592)) ([e71c455](https://github.com/nuxt/nuxt.js/commit/e71c455))
* nuxt-ts ([#4658](https://github.com/nuxt/nuxt.js/issues/4658)) ([ee0096b](https://github.com/nuxt/nuxt.js/commit/ee0096b))
* **test:** unit tests for core/config module ([#4760](https://github.com/nuxt/nuxt.js/issues/4760)) ([a616c09](https://github.com/nuxt/nuxt.js/commit/a616c09))


### Performance Improvements

* **pkg:** remove lodash dependency from packages ([#4411](https://github.com/nuxt/nuxt.js/issues/4411)) ([d7851b3](https://github.com/nuxt/nuxt.js/commit/d7851b3))





## [2.3.4](https://github.com/nuxt/nuxt.js/compare/v2.3.2...v2.3.4) (2018-11-26)


### Bug Fixes

* **pkg:** move opencollective dependency nuxt and nuxt-legacy ([#4415](https://github.com/nuxt/nuxt.js/issues/4415)) ([4a85c03](https://github.com/nuxt/nuxt.js/commit/4a85c03))


### Performance Improvements

* **pkg:** remove lodash dependency from packages ([#4411](https://github.com/nuxt/nuxt.js/issues/4411)) ([7e1beed](https://github.com/nuxt/nuxt.js/commit/7e1beed))
