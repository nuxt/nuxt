# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.6.1](https://github.com/nuxt/nuxt.js/compare/v2.6.0...v2.6.1) (2019-04-04)


### Bug Fixes

* pin esm to 3.2.20 ([#5464](https://github.com/nuxt/nuxt.js/issues/5464)) ([53915c5](https://github.com/nuxt/nuxt.js/commit/53915c5))





# [2.6.0](https://github.com/nuxt/nuxt.js/compare/v2.5.1...v2.6.0) (2019-04-04)


### Features

* **cli:** add `--quiet` option to nuxt generate command ([#5357](https://github.com/nuxt/nuxt.js/issues/5357)) ([91f4eb0](https://github.com/nuxt/nuxt.js/commit/91f4eb0))
* **cli:** add internal _generate and _build options ([#5434](https://github.com/nuxt/nuxt.js/issues/5434)) ([516aea3](https://github.com/nuxt/nuxt.js/commit/516aea3))
* **typescript:** detect typescript based on `tsconfig.json` ([#5412](https://github.com/nuxt/nuxt.js/issues/5412)) ([6ffc5c5](https://github.com/nuxt/nuxt.js/commit/6ffc5c5))





## [2.5.1](https://github.com/nuxt/nuxt.js/compare/v2.5.0...v2.5.1) (2019-03-21)

**Note:** Version bump only for package @nuxt/cli





# [2.5.0](https://github.com/nuxt/nuxt.js/compare/v2.4.5...v2.5.0) (2019-03-21)


### Bug Fixes

* **cli:** enable server for implicit SPA generate in nuxt build ([c46def7](https://github.com/nuxt/nuxt.js/commit/c46def7))
* **pkg:** add missing dependencies ([665f15a](https://github.com/nuxt/nuxt.js/commit/665f15a))
* default for-exit to false to prevent dev exit ([a347ef9](https://github.com/nuxt/nuxt.js/commit/a347ef9))
* disable "analyze" for nuxt generate ([#4975](https://github.com/nuxt/nuxt.js/issues/4975)) ([574a2eb](https://github.com/nuxt/nuxt.js/commit/574a2eb))
* dont force exit when it was explicitly disabled ([#4973](https://github.com/nuxt/nuxt.js/issues/4973)) ([3e9eee2](https://github.com/nuxt/nuxt.js/commit/3e9eee2))


### Code Refactoring

* **ts:** better DX for typescript support ([#5079](https://github.com/nuxt/nuxt.js/issues/5079)) ([920f444](https://github.com/nuxt/nuxt.js/commit/920f444))


### Features

* loading screen ([#5251](https://github.com/nuxt/nuxt.js/issues/5251)) ([ef41e20](https://github.com/nuxt/nuxt.js/commit/ef41e20))
* **cli:** lock project during build or generate  ([#4985](https://github.com/nuxt/nuxt.js/issues/4985)) ([4e51723](https://github.com/nuxt/nuxt.js/commit/4e51723))
* **cli:** option to open the project in the browser  ([#4930](https://github.com/nuxt/nuxt.js/issues/4930)) ([4c7bd9c](https://github.com/nuxt/nuxt.js/commit/4c7bd9c))
* **generate:** return non-zero code or page error (fixes [#4991](https://github.com/nuxt/nuxt.js/issues/4991)) ([#5195](https://github.com/nuxt/nuxt.js/issues/5195)) ([c6565c9](https://github.com/nuxt/nuxt.js/commit/c6565c9))
* show warning on forced exit ([#4958](https://github.com/nuxt/nuxt.js/issues/4958)) ([5094d9c](https://github.com/nuxt/nuxt.js/commit/5094d9c))


### BREAKING CHANGES

* **ts:** `build.useForkTsChecker` renamed to `build.typescript.typeCheck`





## [2.4.4](https://github.com/nuxt/nuxt.js/compare/v2.4.3...v2.4.4) (2019-02-26)


### Bug Fixes

* **nuxt-ts:** error catch in nuxt-ts binary ([#5086](https://github.com/nuxt/nuxt.js/issues/5086)) ([4f887f6](https://github.com/nuxt/nuxt.js/commit/4f887f6))
* dont force exit when it was explicitly disabled ([#4973](https://github.com/nuxt/nuxt.js/issues/4973)) ([4b82aa9](https://github.com/nuxt/nuxt.js/commit/4b82aa9))
* **deps:** update serve-placeholder and esm ([#4970](https://github.com/nuxt/nuxt.js/issues/4970)) ([111455f](https://github.com/nuxt/nuxt.js/commit/111455f))


### Features

* show warning on forced exit ([#4958](https://github.com/nuxt/nuxt.js/issues/4958)) ([3d2deac](https://github.com/nuxt/nuxt.js/commit/3d2deac))





## [2.4.3](https://github.com/nuxt/nuxt.js/compare/v2.4.2...v2.4.3) (2019-02-06)

**Note:** Version bump only for package @nuxt/cli





## [2.4.2](https://github.com/nuxt/nuxt.js/compare/v2.4.1...v2.4.2) (2019-01-30)

**Note:** Version bump only for package @nuxt/cli





## [2.4.1](https://github.com/nuxt/nuxt.js/compare/v2.4.0...v2.4.1) (2019-01-30)

**Note:** Version bump only for package @nuxt/cli





# [2.4.0](https://github.com/nuxt/nuxt.js/compare/v2.3.4...v2.4.0) (2019-01-28)


### Bug Fixes

* exit with proper error code on errors ([#4806](https://github.com/nuxt/nuxt.js/issues/4806)) ([a7ba73e](https://github.com/nuxt/nuxt.js/commit/a7ba73e))
* improvements for build and dev stability ([#4470](https://github.com/nuxt/nuxt.js/issues/4470)) ([fe05169](https://github.com/nuxt/nuxt.js/commit/fe05169))
* modern=true or false not work as expected ([#4378](https://github.com/nuxt/nuxt.js/issues/4378)) ([4c27088](https://github.com/nuxt/nuxt.js/commit/4c27088))
* **config:** define once default nuxt config filename ([#4814](https://github.com/nuxt/nuxt.js/issues/4814)) ([06a18ca](https://github.com/nuxt/nuxt.js/commit/06a18ca))
* **deps:** update all non-major dependencies ([#4358](https://github.com/nuxt/nuxt.js/issues/4358)) ([45fdae0](https://github.com/nuxt/nuxt.js/commit/45fdae0))
* **dev:** Show correct path when webpack watched files changed ([25dea5f](https://github.com/nuxt/nuxt.js/commit/25dea5f))


### Features

* **cli:** add `--devtools` option for build and generate ([#4357](https://github.com/nuxt/nuxt.js/issues/4357)) ([e6f73b5](https://github.com/nuxt/nuxt.js/commit/e6f73b5))
* improve SSR bundle ([#4439](https://github.com/nuxt/nuxt.js/issues/4439)) ([0f104aa](https://github.com/nuxt/nuxt.js/commit/0f104aa)), closes [#4225](https://github.com/nuxt/nuxt.js/issues/4225) [#3465](https://github.com/nuxt/nuxt.js/issues/3465) [#1728](https://github.com/nuxt/nuxt.js/issues/1728) [#1601](https://github.com/nuxt/nuxt.js/issues/1601) [#1481](https://github.com/nuxt/nuxt.js/issues/1481)
* **cli:** improvements and external commands ([#4314](https://github.com/nuxt/nuxt.js/issues/4314)) ([0145551](https://github.com/nuxt/nuxt.js/commit/0145551))
* nuxt-ts ([#4658](https://github.com/nuxt/nuxt.js/issues/4658)) ([ee0096b](https://github.com/nuxt/nuxt.js/commit/ee0096b))
* **nuxt-ts:** typescript support improvements ([#4750](https://github.com/nuxt/nuxt.js/issues/4750)) ([dfaffc0](https://github.com/nuxt/nuxt.js/commit/dfaffc0))
* **test:** unit tests for core/config module ([#4760](https://github.com/nuxt/nuxt.js/issues/4760)) ([a616c09](https://github.com/nuxt/nuxt.js/commit/a616c09))
* **webpack,cli:** standalone build mode ([#4661](https://github.com/nuxt/nuxt.js/issues/4661)) ([bdb6791](https://github.com/nuxt/nuxt.js/commit/bdb6791))





## [2.3.4](https://github.com/nuxt/nuxt.js/compare/v2.3.2...v2.3.4) (2018-11-26)


### Bug Fixes

* modern=true or false not work as expected ([#4378](https://github.com/nuxt/nuxt.js/issues/4378)) ([ff7c083](https://github.com/nuxt/nuxt.js/commit/ff7c083))
