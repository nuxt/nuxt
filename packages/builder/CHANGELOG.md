# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 2.3.1 (2018-11-16)


### Bug Fixes

* **app:** lint all templates ([#4175](https://github.com/nuxt/nuxt.js/issues/4175)) ([96bdcab](https://github.com/nuxt/nuxt.js/commit/96bdcab))
* **builder:** use require.resolve to get the path of babel-loader ([#4150](https://github.com/nuxt/nuxt.js/issues/4150)) ([60dbc6d](https://github.com/nuxt/nuxt.js/commit/60dbc6d))
* **deps:** update all non-major dependencies ([#4156](https://github.com/nuxt/nuxt.js/issues/4156)) ([ff6385f](https://github.com/nuxt/nuxt.js/commit/ff6385f))
* **deps:** update all non-major dependencies ([#4172](https://github.com/nuxt/nuxt.js/issues/4172)) ([1cb7ce5](https://github.com/nuxt/nuxt.js/commit/1cb7ce5))
* **deps:** update all non-major dependencies ([#4253](https://github.com/nuxt/nuxt.js/issues/4253)) ([f10f860](https://github.com/nuxt/nuxt.js/commit/f10f860))
* **deps:** update all non-major dependencies ([#4270](https://github.com/nuxt/nuxt.js/issues/4270)) ([1a154e8](https://github.com/nuxt/nuxt.js/commit/1a154e8))
* **deps:** update all non-major dependencies ([#4271](https://github.com/nuxt/nuxt.js/issues/4271)) ([dd114ff](https://github.com/nuxt/nuxt.js/commit/dd114ff))
* **deps:** update all non-major dependencies ([#4310](https://github.com/nuxt/nuxt.js/issues/4310)) ([bfb6d6a](https://github.com/nuxt/nuxt.js/commit/bfb6d6a))
* **deps:** update dependency consola to ^2.2.0 ([#4269](https://github.com/nuxt/nuxt.js/issues/4269)) ([47f67cc](https://github.com/nuxt/nuxt.js/commit/47f67cc))
* **deps:** update dependency consola to ^2.2.3 ([#4293](https://github.com/nuxt/nuxt.js/issues/4293)) ([b290c07](https://github.com/nuxt/nuxt.js/commit/b290c07))
* **pkg:** stick [@nuxt](https://github.com/nuxt) dependency versions ([#4339](https://github.com/nuxt/nuxt.js/issues/4339)) ([ca5d538](https://github.com/nuxt/nuxt.js/commit/ca5d538))
* **publish:** set each package's publishConfig to public ([28b246d](https://github.com/nuxt/nuxt.js/commit/28b246d)), closes [lerna/lerna#178](https://github.com/lerna/lerna/issues/178)
* check styleResources for existence ([#4155](https://github.com/nuxt/nuxt.js/issues/4155)) ([a3ba6e9](https://github.com/nuxt/nuxt.js/commit/a3ba6e9))
* Duplicate declaration plugin when add/remove file in dev mode ([#4278](https://github.com/nuxt/nuxt.js/issues/4278)) ([3f2b10e](https://github.com/nuxt/nuxt.js/commit/3f2b10e))


### Features

* dx improvements ([#4259](https://github.com/nuxt/nuxt.js/issues/4259)) ([7c4e77f](https://github.com/nuxt/nuxt.js/commit/7c4e77f))
* migrate nuxt into monorepo ([#4051](https://github.com/nuxt/nuxt.js/issues/4051)) ([9c1e0d1](https://github.com/nuxt/nuxt.js/commit/9c1e0d1))
* split builder into more refined modules ([#4171](https://github.com/nuxt/nuxt.js/issues/4171)) ([9df5f49](https://github.com/nuxt/nuxt.js/commit/9df5f49))
* update to consola 2 ([#4247](https://github.com/nuxt/nuxt.js/issues/4247)) ([1dd32d0](https://github.com/nuxt/nuxt.js/commit/1dd32d0))


### Performance Improvements

* cherry-pick only used lodash imports ([#4099](https://github.com/nuxt/nuxt.js/issues/4099)) ([ab5af54](https://github.com/nuxt/nuxt.js/commit/ab5af54))





# 2.3.0 (2018-11-16)


### Bug Fixes

* **app:** lint all templates ([#4175](https://github.com/nuxt/nuxt.js/issues/4175)) ([96bdcab](https://github.com/nuxt/nuxt.js/commit/96bdcab))
* **builder:** use require.resolve to get the path of babel-loader ([#4150](https://github.com/nuxt/nuxt.js/issues/4150)) ([60dbc6d](https://github.com/nuxt/nuxt.js/commit/60dbc6d))
* **deps:** update all non-major dependencies ([#4156](https://github.com/nuxt/nuxt.js/issues/4156)) ([ff6385f](https://github.com/nuxt/nuxt.js/commit/ff6385f))
* **deps:** update all non-major dependencies ([#4172](https://github.com/nuxt/nuxt.js/issues/4172)) ([1cb7ce5](https://github.com/nuxt/nuxt.js/commit/1cb7ce5))
* **deps:** update all non-major dependencies ([#4253](https://github.com/nuxt/nuxt.js/issues/4253)) ([f10f860](https://github.com/nuxt/nuxt.js/commit/f10f860))
* **deps:** update all non-major dependencies ([#4270](https://github.com/nuxt/nuxt.js/issues/4270)) ([1a154e8](https://github.com/nuxt/nuxt.js/commit/1a154e8))
* **deps:** update all non-major dependencies ([#4271](https://github.com/nuxt/nuxt.js/issues/4271)) ([dd114ff](https://github.com/nuxt/nuxt.js/commit/dd114ff))
* **deps:** update all non-major dependencies ([#4310](https://github.com/nuxt/nuxt.js/issues/4310)) ([bfb6d6a](https://github.com/nuxt/nuxt.js/commit/bfb6d6a))
* **deps:** update dependency consola to ^2.2.0 ([#4269](https://github.com/nuxt/nuxt.js/issues/4269)) ([47f67cc](https://github.com/nuxt/nuxt.js/commit/47f67cc))
* **deps:** update dependency consola to ^2.2.3 ([#4293](https://github.com/nuxt/nuxt.js/issues/4293)) ([b290c07](https://github.com/nuxt/nuxt.js/commit/b290c07))
* **pkg:** stick [@nuxt](https://github.com/nuxt) dependency versions ([#4339](https://github.com/nuxt/nuxt.js/issues/4339)) ([ca5d538](https://github.com/nuxt/nuxt.js/commit/ca5d538))
* **publish:** set each package's publishConfig to public ([28b246d](https://github.com/nuxt/nuxt.js/commit/28b246d)), closes [lerna/lerna#178](https://github.com/lerna/lerna/issues/178)
* check styleResources for existence ([#4155](https://github.com/nuxt/nuxt.js/issues/4155)) ([a3ba6e9](https://github.com/nuxt/nuxt.js/commit/a3ba6e9))
* Duplicate declaration plugin when add/remove file in dev mode ([#4278](https://github.com/nuxt/nuxt.js/issues/4278)) ([3f2b10e](https://github.com/nuxt/nuxt.js/commit/3f2b10e))


### Features

* dx improvements ([#4259](https://github.com/nuxt/nuxt.js/issues/4259)) ([7c4e77f](https://github.com/nuxt/nuxt.js/commit/7c4e77f))
* migrate nuxt into monorepo ([#4051](https://github.com/nuxt/nuxt.js/issues/4051)) ([9c1e0d1](https://github.com/nuxt/nuxt.js/commit/9c1e0d1))
* split builder into more refined modules ([#4171](https://github.com/nuxt/nuxt.js/issues/4171)) ([9df5f49](https://github.com/nuxt/nuxt.js/commit/9df5f49))
* update to consola 2 ([#4247](https://github.com/nuxt/nuxt.js/issues/4247)) ([1dd32d0](https://github.com/nuxt/nuxt.js/commit/1dd32d0))


### Performance Improvements

* cherry-pick only used lodash imports ([#4099](https://github.com/nuxt/nuxt.js/issues/4099)) ([ab5af54](https://github.com/nuxt/nuxt.js/commit/ab5af54))
