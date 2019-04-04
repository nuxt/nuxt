# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.6.1](https://github.com/nuxt/nuxt.js/compare/v2.6.0...v2.6.1) (2019-04-04)

**Note:** Version bump only for package @nuxt/builder





# [2.6.0](https://github.com/nuxt/nuxt.js/compare/v2.5.1...v2.6.0) (2019-04-04)


### Bug Fixes

* fail in case of missing core-js dependency ([#5342](https://github.com/nuxt/nuxt.js/issues/5342)) ([439b914](https://github.com/nuxt/nuxt.js/commit/439b914))





## [2.5.1](https://github.com/nuxt/nuxt.js/compare/v2.5.0...v2.5.1) (2019-03-21)

**Note:** Version bump only for package @nuxt/builder





# [2.5.0](https://github.com/nuxt/nuxt.js/compare/v2.4.5...v2.5.0) (2019-03-21)


### Bug Fixes

* **builder, vue-app:** order of plugin execution based on order in array ([#5163](https://github.com/nuxt/nuxt.js/issues/5163)) ([a867dbd](https://github.com/nuxt/nuxt.js/commit/a867dbd))
* refactor file watchers (chokidar/linux workaround) ([#4950](https://github.com/nuxt/nuxt.js/issues/4950)) ([5ec5932](https://github.com/nuxt/nuxt.js/commit/5ec5932))
* **test:** unhandled open handles ([858c9ee](https://github.com/nuxt/nuxt.js/commit/858c9ee))
* extra properties in templateFiles ([#4925](https://github.com/nuxt/nuxt.js/issues/4925)) ([ca19124](https://github.com/nuxt/nuxt.js/commit/ca19124))
* revert templatFiles name ([#4924](https://github.com/nuxt/nuxt.js/issues/4924)) ([f70645e](https://github.com/nuxt/nuxt.js/commit/f70645e))


### Features

* **test:** unit tests for @nuxt/builder ([#4834](https://github.com/nuxt/nuxt.js/issues/4834)) ([43491f6](https://github.com/nuxt/nuxt.js/commit/43491f6))
* **vue-app:** universal fetch ([#5028](https://github.com/nuxt/nuxt.js/issues/5028)) ([2015140](https://github.com/nuxt/nuxt.js/commit/2015140))
* .nuxtignore ([#4647](https://github.com/nuxt/nuxt.js/issues/4647)) ([59be77a](https://github.com/nuxt/nuxt.js/commit/59be77a))





## [2.4.4](https://github.com/nuxt/nuxt.js/compare/v2.4.3...v2.4.4) (2019-02-26)

**Note:** Version bump only for package @nuxt/builder





## [2.4.3](https://github.com/nuxt/nuxt.js/compare/v2.4.2...v2.4.3) (2019-02-06)

**Note:** Version bump only for package @nuxt/builder





## [2.4.2](https://github.com/nuxt/nuxt.js/compare/v2.4.1...v2.4.2) (2019-01-30)

**Note:** Version bump only for package @nuxt/builder





## [2.4.1](https://github.com/nuxt/nuxt.js/compare/v2.4.0...v2.4.1) (2019-01-30)

**Note:** Version bump only for package @nuxt/builder





# [2.4.0](https://github.com/nuxt/nuxt.js/compare/v2.3.4...v2.4.0) (2019-01-28)


### Bug Fixes

* plugins for modern mode ([#4659](https://github.com/nuxt/nuxt.js/issues/4659)) ([867e8e1](https://github.com/nuxt/nuxt.js/commit/867e8e1))
* **builder:** add lodash inside templates ([#4368](https://github.com/nuxt/nuxt.js/issues/4368)) ([27e79be](https://github.com/nuxt/nuxt.js/commit/27e79be))
* add option to rewatch on path after raw fs event ([#4717](https://github.com/nuxt/nuxt.js/issues/4717)) ([9c6df49](https://github.com/nuxt/nuxt.js/commit/9c6df49))
* detect plugin without extension ([#4579](https://github.com/nuxt/nuxt.js/issues/4579)) ([e7df65b](https://github.com/nuxt/nuxt.js/commit/e7df65b))
* improvements for build and dev stability ([#4470](https://github.com/nuxt/nuxt.js/issues/4470)) ([fe05169](https://github.com/nuxt/nuxt.js/commit/fe05169))
* invalid plugin mode warning for all ([9b3e7be](https://github.com/nuxt/nuxt.js/commit/9b3e7be))
* no false positives for plugins with index.js ([#4714](https://github.com/nuxt/nuxt.js/issues/4714)) ([eef2af3](https://github.com/nuxt/nuxt.js/commit/eef2af3)), closes [#4713](https://github.com/nuxt/nuxt.js/issues/4713)
* properly serialize head functions ([#4558](https://github.com/nuxt/nuxt.js/issues/4558)) ([7831e57](https://github.com/nuxt/nuxt.js/commit/7831e57)), closes [#4079](https://github.com/nuxt/nuxt.js/issues/4079)
* watch custom patterns only when it exists ([#4823](https://github.com/nuxt/nuxt.js/issues/4823)) ([3966b26](https://github.com/nuxt/nuxt.js/commit/3966b26))
* **builder:** js layout ([#4701](https://github.com/nuxt/nuxt.js/issues/4701)) ([af76e07](https://github.com/nuxt/nuxt.js/commit/af76e07))
* **builder:** layouts condition ([#4641](https://github.com/nuxt/nuxt.js/issues/4641)) ([6436e3b](https://github.com/nuxt/nuxt.js/commit/6436e3b))
* **builder, module:** addLayout and nuxt.config precedence over auto-scanned layouts ([#4702](https://github.com/nuxt/nuxt.js/issues/4702)) ([f85ac94](https://github.com/nuxt/nuxt.js/commit/f85ac94))
* **deps:** update all non-major dependencies ([#4358](https://github.com/nuxt/nuxt.js/issues/4358)) ([45fdae0](https://github.com/nuxt/nuxt.js/commit/45fdae0))
* **ts:** switch from babel preset to ts-loader ([#4563](https://github.com/nuxt/nuxt.js/issues/4563)) ([75e3df6](https://github.com/nuxt/nuxt.js/commit/75e3df6))


### Features

* **builder:** optional typescript support ([#4557](https://github.com/nuxt/nuxt.js/issues/4557)) ([7145c1a](https://github.com/nuxt/nuxt.js/commit/7145c1a))
* mode for plugins ([#4592](https://github.com/nuxt/nuxt.js/issues/4592)) ([e71c455](https://github.com/nuxt/nuxt.js/commit/e71c455))
* **builder:** validate vue-app dependencies and suggest fix ([#4669](https://github.com/nuxt/nuxt.js/issues/4669)) ([7dd33fe](https://github.com/nuxt/nuxt.js/commit/7dd33fe))
* **router:** custom route name splitter ([#4598](https://github.com/nuxt/nuxt.js/issues/4598)) ([add8000](https://github.com/nuxt/nuxt.js/commit/add8000))
* **ts:** add TSX support ([#4613](https://github.com/nuxt/nuxt.js/issues/4613)) ([4d52742](https://github.com/nuxt/nuxt.js/commit/4d52742))





## [2.3.4](https://github.com/nuxt/nuxt.js/compare/v2.3.2...v2.3.4) (2018-11-26)

**Note:** Version bump only for package @nuxt/builder
