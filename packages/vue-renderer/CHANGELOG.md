# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.6.1](https://github.com/nuxt/nuxt.js/compare/v2.6.0...v2.6.1) (2019-04-04)

**Note:** Version bump only for package @nuxt/vue-renderer





# [2.6.0](https://github.com/nuxt/nuxt.js/compare/v2.5.1...v2.6.0) (2019-04-04)


### Bug Fixes

* **builder:** await for renderer to load resources ([#5341](https://github.com/nuxt/nuxt.js/issues/5341)) ([caf5198](https://github.com/nuxt/nuxt.js/commit/caf5198))
* **renderer:** retry render if renderer is in loading or created state ([#5417](https://github.com/nuxt/nuxt.js/issues/5417)) ([8b99695](https://github.com/nuxt/nuxt.js/commit/8b99695))
* **vue-renderer:** add the csp hash if `unsafe-inline` hasn't been specified ([#5387](https://github.com/nuxt/nuxt.js/issues/5387)) ([97db6a4](https://github.com/nuxt/nuxt.js/commit/97db6a4))


### Features

* **vue-renderer:** add csp meta tags ([#5354](https://github.com/nuxt/nuxt.js/issues/5354)) ([b978a37](https://github.com/nuxt/nuxt.js/commit/b978a37))





## [2.5.1](https://github.com/nuxt/nuxt.js/compare/v2.5.0...v2.5.1) (2019-03-21)

**Note:** Version bump only for package @nuxt/vue-renderer





# [2.5.0](https://github.com/nuxt/nuxt.js/compare/v2.4.5...v2.5.0) (2019-03-21)


### Bug Fixes

* correct public path in generation and start ([#5202](https://github.com/nuxt/nuxt.js/issues/5202)) ([648062c](https://github.com/nuxt/nuxt.js/commit/648062c))


### Features

* loading screen ([#5251](https://github.com/nuxt/nuxt.js/issues/5251)) ([ef41e20](https://github.com/nuxt/nuxt.js/commit/ef41e20))
* **vue-renderer:** improvements ([#4722](https://github.com/nuxt/nuxt.js/issues/4722)) ([2929716](https://github.com/nuxt/nuxt.js/commit/2929716))
* **vue-renderer:** use async fs ([#5186](https://github.com/nuxt/nuxt.js/issues/5186)) ([d07aefa](https://github.com/nuxt/nuxt.js/commit/d07aefa))
* upgrade vue to 2.6 ([#4953](https://github.com/nuxt/nuxt.js/issues/4953)) ([9308954](https://github.com/nuxt/nuxt.js/commit/9308954))





## [2.4.4](https://github.com/nuxt/nuxt.js/compare/v2.4.3...v2.4.4) (2019-02-26)


### Bug Fixes

* **hotfix:** preload modern resource in spa modern mode ([#5043](https://github.com/nuxt/nuxt.js/issues/5043)) ([3516580](https://github.com/nuxt/nuxt.js/commit/3516580))





## [2.4.3](https://github.com/nuxt/nuxt.js/compare/v2.4.2...v2.4.3) (2019-02-06)

**Note:** Version bump only for package @nuxt/vue-renderer





## [2.4.2](https://github.com/nuxt/nuxt.js/compare/v2.4.1...v2.4.2) (2019-01-30)

**Note:** Version bump only for package @nuxt/vue-renderer





## [2.4.1](https://github.com/nuxt/nuxt.js/compare/v2.4.0...v2.4.1) (2019-01-30)

**Note:** Version bump only for package @nuxt/vue-renderer





# [2.4.0](https://github.com/nuxt/nuxt.js/compare/v2.3.4...v2.4.0) (2019-01-28)


### Bug Fixes

* **deps:** update all non-major dependencies ([#4358](https://github.com/nuxt/nuxt.js/issues/4358)) ([45fdae0](https://github.com/nuxt/nuxt.js/commit/45fdae0))
* **deps:** update dependency vue-no-ssr to ^1.1.0 ([#4372](https://github.com/nuxt/nuxt.js/issues/4372)) ([e731250](https://github.com/nuxt/nuxt.js/commit/e731250))
* correct renderer.noSSR name ([6990efc](https://github.com/nuxt/nuxt.js/commit/6990efc))
* **renderer:** ignore invalid sourcemaps ([4b643b9](https://github.com/nuxt/nuxt.js/commit/4b643b9))
* **vue-renderer:** improve ready handling ([#4511](https://github.com/nuxt/nuxt.js/issues/4511)) ([f0cb654](https://github.com/nuxt/nuxt.js/commit/f0cb654))
* **vue-renderer:** parse JSON values before passing to bundle-renderer ([c0721c0](https://github.com/nuxt/nuxt.js/commit/c0721c0)), closes [#4439](https://github.com/nuxt/nuxt.js/issues/4439)
* csp SHA hashes accumulate when using custom script-src rules ([#4519](https://github.com/nuxt/nuxt.js/issues/4519)) ([683dbba](https://github.com/nuxt/nuxt.js/commit/683dbba))
* hmr in modern mode ([#4623](https://github.com/nuxt/nuxt.js/issues/4623)) ([df9b32a](https://github.com/nuxt/nuxt.js/commit/df9b32a))
* improvements for build and dev stability ([#4470](https://github.com/nuxt/nuxt.js/issues/4470)) ([fe05169](https://github.com/nuxt/nuxt.js/commit/fe05169))
* undefined script in modern mode ([0a21d4b](https://github.com/nuxt/nuxt.js/commit/0a21d4b))


### Features

* **modern:** auto detect modern mode ([#4422](https://github.com/nuxt/nuxt.js/issues/4422)) ([fe492d8](https://github.com/nuxt/nuxt.js/commit/fe492d8))
* check modern build file in modern mode ([#4467](https://github.com/nuxt/nuxt.js/issues/4467)) ([14fe679](https://github.com/nuxt/nuxt.js/commit/14fe679))
* improve SSR bundle ([#4439](https://github.com/nuxt/nuxt.js/issues/4439)) ([0f104aa](https://github.com/nuxt/nuxt.js/commit/0f104aa)), closes [#4225](https://github.com/nuxt/nuxt.js/issues/4225) [#3465](https://github.com/nuxt/nuxt.js/issues/3465) [#1728](https://github.com/nuxt/nuxt.js/issues/1728) [#1601](https://github.com/nuxt/nuxt.js/issues/1601) [#1481](https://github.com/nuxt/nuxt.js/issues/1481)
* preload and push modern resources in modern mode ([#4362](https://github.com/nuxt/nuxt.js/issues/4362)) ([701190d](https://github.com/nuxt/nuxt.js/commit/701190d))
* use runInNewContext: true for nuxt dev ([#4508](https://github.com/nuxt/nuxt.js/issues/4508)) ([1162f2d](https://github.com/nuxt/nuxt.js/commit/1162f2d))
* **vue-app, vue-renderer:** support meta `headAttrs` ([#4536](https://github.com/nuxt/nuxt.js/issues/4536)) ([9961453](https://github.com/nuxt/nuxt.js/commit/9961453))





## [2.3.4](https://github.com/nuxt/nuxt.js/compare/v2.3.2...v2.3.4) (2018-11-26)

**Note:** Version bump only for package @nuxt/vue-renderer
