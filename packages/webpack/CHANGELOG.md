# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.6.1](https://github.com/nuxt/nuxt.js/compare/v2.6.0...v2.6.1) (2019-04-04)

**Note:** Version bump only for package @nuxt/webpack





# [2.6.0](https://github.com/nuxt/nuxt.js/compare/v2.5.1...v2.6.0) (2019-04-04)


### Bug Fixes

* revert node-externals disabling in dev mode ([#5452](https://github.com/nuxt/nuxt.js/issues/5452)) ([6ce99d2](https://github.com/nuxt/nuxt.js/commit/6ce99d2))
* **webpack:** prefer `main` over `module` field for server config ([#5446](https://github.com/nuxt/nuxt.js/issues/5446)) ([e155ea4](https://github.com/nuxt/nuxt.js/commit/e155ea4))
* disable `node-externals` for dev mode ([#5414](https://github.com/nuxt/nuxt.js/issues/5414)) ([a5a1657](https://github.com/nuxt/nuxt.js/commit/a5a1657))
* memory leak in dev mode ([#5399](https://github.com/nuxt/nuxt.js/issues/5399)) ([04ddcac](https://github.com/nuxt/nuxt.js/commit/04ddcac))
* not override externals set by build.extend ([#5444](https://github.com/nuxt/nuxt.js/issues/5444)) ([1ae4333](https://github.com/nuxt/nuxt.js/commit/1ae4333))
* **builder:** await for renderer to load resources ([#5341](https://github.com/nuxt/nuxt.js/issues/5341)) ([caf5198](https://github.com/nuxt/nuxt.js/commit/caf5198))





## [2.5.1](https://github.com/nuxt/nuxt.js/compare/v2.5.0...v2.5.1) (2019-03-21)

**Note:** Version bump only for package @nuxt/webpack





# [2.5.0](https://github.com/nuxt/nuxt.js/compare/v2.4.5...v2.5.0) (2019-03-21)


### Bug Fixes

* **postcss:** default to preset-env and cssnano last ([#5215](https://github.com/nuxt/nuxt.js/issues/5215)) ([adf423a](https://github.com/nuxt/nuxt.js/commit/adf423a))
* **webpack:** always resolve core-js to v3 ([#5307](https://github.com/nuxt/nuxt.js/issues/5307)) ([65c1f86](https://github.com/nuxt/nuxt.js/commit/65c1f86))
* **webpack:** clone `config.entry` (fixes [#4849](https://github.com/nuxt/nuxt.js/issues/4849)) ([#5236](https://github.com/nuxt/nuxt.js/issues/5236)) ([8216765](https://github.com/nuxt/nuxt.js/commit/8216765))
* **webpack:** loaders in extend config is broken ([#5292](https://github.com/nuxt/nuxt.js/issues/5292)) ([0eb5ed9](https://github.com/nuxt/nuxt.js/commit/0eb5ed9))
* bundle resources other than js(x)/json in node_modules ([#4913](https://github.com/nuxt/nuxt.js/issues/4913)) ([268851f](https://github.com/nuxt/nuxt.js/commit/268851f))
* fix non standard esm modifications ([fb87a55](https://github.com/nuxt/nuxt.js/commit/fb87a55))
* remove cache-loader for external resources ([#4915](https://github.com/nuxt/nuxt.js/issues/4915)) ([0223e56](https://github.com/nuxt/nuxt.js/commit/0223e56))
* warn when using array postcss configuration ([#4936](https://github.com/nuxt/nuxt.js/issues/4936)) ([422155e](https://github.com/nuxt/nuxt.js/commit/422155e))


### Code Refactoring

* **ts:** better DX for typescript support ([#5079](https://github.com/nuxt/nuxt.js/issues/5079)) ([920f444](https://github.com/nuxt/nuxt.js/commit/920f444))


### Features

* loading screen ([#5251](https://github.com/nuxt/nuxt.js/issues/5251)) ([ef41e20](https://github.com/nuxt/nuxt.js/commit/ef41e20))
* support core-js 3 ([#5291](https://github.com/nuxt/nuxt.js/issues/5291)) ([d094c4a](https://github.com/nuxt/nuxt.js/commit/d094c4a))
* **vue-renderer:** use async fs ([#5186](https://github.com/nuxt/nuxt.js/issues/5186)) ([d07aefa](https://github.com/nuxt/nuxt.js/commit/d07aefa))


### Performance Improvements

* **webpack:** use `futureEmitAssets` ([#5003](https://github.com/nuxt/nuxt.js/issues/5003)) ([3997d50](https://github.com/nuxt/nuxt.js/commit/3997d50))


### BREAKING CHANGES

* **ts:** `build.useForkTsChecker` renamed to `build.typescript.typeCheck`





## [2.4.4](https://github.com/nuxt/nuxt.js/compare/v2.4.3...v2.4.4) (2019-02-26)


### Bug Fixes

* bundle resources other than js(x)/json in node_modules ([#4913](https://github.com/nuxt/nuxt.js/issues/4913)) ([71a70fe](https://github.com/nuxt/nuxt.js/commit/71a70fe))





## [2.4.3](https://github.com/nuxt/nuxt.js/compare/v2.4.2...v2.4.3) (2019-02-06)


### Bug Fixes

* update terser-webpack-plugin to 1.2.2 ([b1a5a19](https://github.com/nuxt/nuxt.js/commit/b1a5a19))
* update webpack to 4.29.1 ([95ef1d4](https://github.com/nuxt/nuxt.js/commit/95ef1d4))





## [2.4.2](https://github.com/nuxt/nuxt.js/compare/v2.4.1...v2.4.2) (2019-01-30)

**Note:** Version bump only for package @nuxt/webpack





## [2.4.1](https://github.com/nuxt/nuxt.js/compare/v2.4.0...v2.4.1) (2019-01-30)

**Note:** Version bump only for package @nuxt/webpack





# [2.4.0](https://github.com/nuxt/nuxt.js/compare/v2.3.4...v2.4.0) (2019-01-28)


### Bug Fixes

* thread-loader slow building ([4fb220c](https://github.com/nuxt/nuxt.js/commit/4fb220c))
* **deps:** update all non-major dependencies ([#4358](https://github.com/nuxt/nuxt.js/issues/4358)) ([45fdae0](https://github.com/nuxt/nuxt.js/commit/45fdae0))
* allow pcss ending for webpack loader ([#4530](https://github.com/nuxt/nuxt.js/issues/4530)) ([8e0b508](https://github.com/nuxt/nuxt.js/commit/8e0b508))
* empty error message in dev mode ([3d990fe](https://github.com/nuxt/nuxt.js/commit/3d990fe))
* enable FriendlyErrorsPlugin when build.friendlyErrors is true ([30fef5d](https://github.com/nuxt/nuxt.js/commit/30fef5d))
* hmr in modern mode ([#4623](https://github.com/nuxt/nuxt.js/issues/4623)) ([df9b32a](https://github.com/nuxt/nuxt.js/commit/df9b32a))
* improvements for build and dev stability ([#4470](https://github.com/nuxt/nuxt.js/issues/4470)) ([fe05169](https://github.com/nuxt/nuxt.js/commit/fe05169))
* match subdir under node_module  in transpile ([#4850](https://github.com/nuxt/nuxt.js/issues/4850)) ([43ce8e9](https://github.com/nuxt/nuxt.js/commit/43ce8e9))
* plugins for modern mode ([#4659](https://github.com/nuxt/nuxt.js/issues/4659)) ([867e8e1](https://github.com/nuxt/nuxt.js/commit/867e8e1))
* require postcss module via resolver ([#4737](https://github.com/nuxt/nuxt.js/issues/4737)) ([4b9e8e7](https://github.com/nuxt/nuxt.js/commit/4b9e8e7))
* SafariFix is not injected in client modern mode ([ecf76d9](https://github.com/nuxt/nuxt.js/commit/ecf76d9))
* server build failed in dev mode ([89f8866](https://github.com/nuxt/nuxt.js/commit/89f8866))
* thread-loader memory leak ([d34a9e2](https://github.com/nuxt/nuxt.js/commit/d34a9e2))
* use case insensitive regex for webpack loader rules ([#4728](https://github.com/nuxt/nuxt.js/issues/4728)) ([68d8d54](https://github.com/nuxt/nuxt.js/commit/68d8d54))
* **server:** delete all non-js assets ([6589670](https://github.com/nuxt/nuxt.js/commit/6589670))
* **ts:** prevent checking types twice in modern mode & use consola as logger ([#4803](https://github.com/nuxt/nuxt.js/issues/4803)) ([b202361](https://github.com/nuxt/nuxt.js/commit/b202361))
* **ts:** switch from babel preset to ts-loader ([#4563](https://github.com/nuxt/nuxt.js/issues/4563)) ([75e3df6](https://github.com/nuxt/nuxt.js/commit/75e3df6))
* **webpack:** allow changing devtool with extend ([#4515](https://github.com/nuxt/nuxt.js/issues/4515)) ([33edef2](https://github.com/nuxt/nuxt.js/commit/33edef2))
* **webpack:** deepClone before calling extendConfig ([#4464](https://github.com/nuxt/nuxt.js/issues/4464)) ([06ddfbb](https://github.com/nuxt/nuxt.js/commit/06ddfbb))
* **webpack:** prevent terser mangling html/vue reserved tags ([#4821](https://github.com/nuxt/nuxt.js/issues/4821)) ([6a68f4e](https://github.com/nuxt/nuxt.js/commit/6a68f4e))


### Features

* add an option to disable FriendlyErrorsWebpackPlugin ([#4498](https://github.com/nuxt/nuxt.js/issues/4498)) ([f1b2ca3](https://github.com/nuxt/nuxt.js/commit/f1b2ca3))
* add process.modern ([#4532](https://github.com/nuxt/nuxt.js/issues/4532)) ([f1ff634](https://github.com/nuxt/nuxt.js/commit/f1ff634))
* allow `lang="postcss"` in Vue SFCs ([#4417](https://github.com/nuxt/nuxt.js/issues/4417)) ([71136fc](https://github.com/nuxt/nuxt.js/commit/71136fc))
* attach ts-loader options on build.loaders.ts ([#4572](https://github.com/nuxt/nuxt.js/issues/4572)) ([d723e49](https://github.com/nuxt/nuxt.js/commit/d723e49))
* **builder:** optional typescript support ([#4557](https://github.com/nuxt/nuxt.js/issues/4557)) ([7145c1a](https://github.com/nuxt/nuxt.js/commit/7145c1a))
* **nuxt-ts:** typescript support improvements ([#4750](https://github.com/nuxt/nuxt.js/issues/4750)) ([dfaffc0](https://github.com/nuxt/nuxt.js/commit/dfaffc0))
* **ts:** add TSX support ([#4613](https://github.com/nuxt/nuxt.js/issues/4613)) ([4d52742](https://github.com/nuxt/nuxt.js/commit/4d52742))
* **ts:** provide type checking through `fork-ts-checker-webpack-plugin` ([#4611](https://github.com/nuxt/nuxt.js/issues/4611)) ([f1377a7](https://github.com/nuxt/nuxt.js/commit/f1377a7))
* **webpack:** add experimental HardSourceWebpackPlugin support ([#4527](https://github.com/nuxt/nuxt.js/issues/4527)) ([c6d820a](https://github.com/nuxt/nuxt.js/commit/c6d820a))
* **webpack:** options.build.loaders.vueStyle ([#4837](https://github.com/nuxt/nuxt.js/issues/4837)) ([762305b](https://github.com/nuxt/nuxt.js/commit/762305b))
* **webpack:** support `build.hotMiddleware.client` ([#4796](https://github.com/nuxt/nuxt.js/issues/4796)) ([dcdbaba](https://github.com/nuxt/nuxt.js/commit/dcdbaba))
* **webpack,cli:** standalone build mode ([#4661](https://github.com/nuxt/nuxt.js/issues/4661)) ([bdb6791](https://github.com/nuxt/nuxt.js/commit/bdb6791))
* better stack traces for SSR error, show error with correct URL and use eventsource-polyfill ([#4600](https://github.com/nuxt/nuxt.js/issues/4600)) ([498c4f1](https://github.com/nuxt/nuxt.js/commit/498c4f1))
* improve SSR bundle ([#4439](https://github.com/nuxt/nuxt.js/issues/4439)) ([0f104aa](https://github.com/nuxt/nuxt.js/commit/0f104aa)), closes [#4225](https://github.com/nuxt/nuxt.js/issues/4225) [#3465](https://github.com/nuxt/nuxt.js/issues/3465) [#1728](https://github.com/nuxt/nuxt.js/issues/1728) [#1601](https://github.com/nuxt/nuxt.js/issues/1601) [#1481](https://github.com/nuxt/nuxt.js/issues/1481)
* mode for plugins ([#4592](https://github.com/nuxt/nuxt.js/issues/4592)) ([e71c455](https://github.com/nuxt/nuxt.js/commit/e71c455))
* upgrade css loader to v2 ([#4503](https://github.com/nuxt/nuxt.js/issues/4503)) ([af9b30c](https://github.com/nuxt/nuxt.js/commit/af9b30c))


### Performance Improvements

* **pkg:** remove lodash dependency from packages ([#4411](https://github.com/nuxt/nuxt.js/issues/4411)) ([d7851b3](https://github.com/nuxt/nuxt.js/commit/d7851b3))





## [2.3.4](https://github.com/nuxt/nuxt.js/compare/v2.3.2...v2.3.4) (2018-11-26)


### Bug Fixes

* empty error message in dev mode ([47f02ae](https://github.com/nuxt/nuxt.js/commit/47f02ae))


### Performance Improvements

* **pkg:** remove lodash dependency from packages ([#4411](https://github.com/nuxt/nuxt.js/issues/4411)) ([7e1beed](https://github.com/nuxt/nuxt.js/commit/7e1beed))
