# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.2.4](https://github.com/nuxt/framework/compare/nuxt3@0.2.3...nuxt3@0.2.4) (2021-04-06)

**Note:** Version bump only for package nuxt3





## [0.2.3](https://github.com/nuxt/framework/compare/nuxt3@0.2.2...nuxt3@0.2.3) (2021-04-04)

**Note:** Version bump only for package nuxt3





## [0.2.2](https://github.com/nuxt/framework/compare/nuxt3@0.2.1...nuxt3@0.2.2) (2021-04-04)


### Bug Fixes

* **nitro:** resolve alias for serverMiddleware ([c864c5a](https://github.com/nuxt/framework/commit/c864c5a30cfc38362e35ee4c7015b589d445edee))





## [0.2.1](https://github.com/nuxt/framework/compare/nuxt3@0.2.0...nuxt3@0.2.1) (2021-04-04)


### Bug Fixes

* **nuxt3:** install nuxt-cli by default ([3e794a3](https://github.com/nuxt/framework/commit/3e794a36f2b1aa9fd729f7556741c47930a30b64))





# 0.2.0 (2021-04-04)


### Bug Fixes

* **app:** provide appDir via meta export ([94d3697](https://github.com/nuxt/framework/commit/94d36976c79ff549a8d510795e7d47c5e32b8f96))
* webpack compilation ([#41](https://github.com/nuxt/framework/issues/41)) ([2c1eb87](https://github.com/nuxt/framework/commit/2c1eb8767180fc04b91fb409976b4fe1e0c3047d))
* **app:** improve composables ([#183](https://github.com/nuxt/framework/issues/183)) ([451fc29](https://github.com/nuxt/framework/commit/451fc29b60683bf37f4b311cbbca10f12da6e508))
* **webpack:** types in webpack and await compiler close ([#176](https://github.com/nuxt/framework/issues/176)) ([2c9854d](https://github.com/nuxt/framework/commit/2c9854dfe347e35046819102dee2ed8420cbd324))
* import Builder not as default ([daaa8ed](https://github.com/nuxt/framework/commit/daaa8eda8cf48f4f9da70946a77a39b2208cec25))
* include nitro.client plugin for global $fetch ([23f6578](https://github.com/nuxt/framework/commit/23f6578c88f05d148efdaa08a13d865b12d92255))
* remove runtimeChunk options (HMR push of undefined error) ([7309ef3](https://github.com/nuxt/framework/commit/7309ef303a928295ca04a6ad4cfab3ccb4891f6e))
* update nitro preset for dev ([040e14f](https://github.com/nuxt/framework/commit/040e14f2b6b93f47a3e1c7cd2ae821cdfab3c53c))
* **types:** type definitions errors ([#172](https://github.com/nuxt/framework/issues/172)) ([52d28c0](https://github.com/nuxt/framework/commit/52d28c041a0dbf46dd0cb5492835b0d1fbd7436b))
* allow resolving relative `package.json` in vite mode ([abb21f3](https://github.com/nuxt/framework/commit/abb21f30cacb232f717c9cd20e6c2aac295cf5a2)), closes [#146](https://github.com/nuxt/framework/issues/146)
* don't display 404 page if no pages/ ([d63b283](https://github.com/nuxt/framework/commit/d63b28303ece59df69f79def167aea97bc7ed5e4))
* init nitro before module container (closes [#165](https://github.com/nuxt/framework/issues/165)) ([270bbbc](https://github.com/nuxt/framework/commit/270bbbc47ef0b9a95042feebac3cc1ecb3f44683))
* polyfill $fetch on globalThis ([a1ac066](https://github.com/nuxt/framework/commit/a1ac066cb51fa99861d52799a11ff4bb1780316c))
* remove use of html-webpack-plugin ([c89166f](https://github.com/nuxt/framework/commit/c89166f8f998d8d156b69ca43f06aaff225afd88))
* replace ~build with nuxt/build ([52592a5](https://github.com/nuxt/framework/commit/52592a5d64ec0fc654fd9081f6abd1785672573c))
* **build:** style not work in vue ([dab1a83](https://github.com/nuxt/framework/commit/dab1a831a68760b1a092c26b8c778730b75273f4))
* **build:** use last hash file name in client manifest ([#123](https://github.com/nuxt/framework/issues/123)) ([8e320f8](https://github.com/nuxt/framework/commit/8e320f80aa346efa6085b9b66327b5bd8b8e3e38))
* **builder:** empty buildDir only once by build ([7b3244a](https://github.com/nuxt/framework/commit/7b3244a567524a47cd566741b62b67d7d66453c1))
* **builder:** empty dir before generate ([8a1cb84](https://github.com/nuxt/framework/commit/8a1cb845187540ea41acecd75369d95047ba5014))
* **renderer:** missing nomodule on legacy modules ([d171823](https://github.com/nuxt/framework/commit/d1718230edc7a2385d504abb0d3c61e44ea9968d))
* **router:** generate empty array ([#133](https://github.com/nuxt/framework/issues/133)) ([0b31d93](https://github.com/nuxt/framework/commit/0b31d93892e6ef955dad08edd12ea747a48e56c7)), closes [#129](https://github.com/nuxt/framework/issues/129)
* **ssr:** update ssr/client manifect after webpack v5 beta.30 ([#48](https://github.com/nuxt/framework/issues/48)) ([db050fd](https://github.com/nuxt/framework/commit/db050fd0a2049ccac64f6fed2848f3b46ef47162))
* **vite:** include deps from nuxt3 package ([694a6b5](https://github.com/nuxt/framework/commit/694a6b5635e17448fb5f55c7523369f7b8cd5884))
* **webpack:** remove hmr chunks from client manifest ([64ca193](https://github.com/nuxt/framework/commit/64ca193ac9b636607f2fb16f37a8b78a14627922))
* remove NuxtChild refs ([#113](https://github.com/nuxt/framework/issues/113)) ([ba0fae7](https://github.com/nuxt/framework/commit/ba0fae74a741dbcaafafdf3e4b8592672a94593a))
* **webpack:** DeprecationWarning DEP_WEBPACK_COMPILATION_ASSETS ([#57](https://github.com/nuxt/framework/issues/57)) ([20c2375](https://github.com/nuxt/framework/commit/20c2375e74537d85073dbf93c8785a37aefad72d))
* **webpack:** use modern target for esbuild ([ae32ca4](https://github.com/nuxt/framework/commit/ae32ca42fa1785ee801939e812b477c741a2837f))
* **webpack5:** plugins/vue/server DeprecationWarning ([8936fe7](https://github.com/nuxt/framework/commit/8936fe77ebfca9ee22d620cc08b4bd47167f495c))
* RouterLink import ([00e13c3](https://github.com/nuxt/framework/commit/00e13c3e41275caf21496a2e9c2c8667ca68fd65))


### Features

* `@nuxt/kit` and new config schema ([#34](https://github.com/nuxt/framework/issues/34)) ([46f771a](https://github.com/nuxt/framework/commit/46f771a98b6226e19e9df3511e31b4ec2da6abda))
* add `nuxt-head` component ([#166](https://github.com/nuxt/framework/issues/166)) ([545bfe4](https://github.com/nuxt/framework/commit/545bfe4f9e1dab086e03eb2cdad151b754cb90ba))
* add asyncData and improve reactivity ([#174](https://github.com/nuxt/framework/issues/174)) ([5248c61](https://github.com/nuxt/framework/commit/5248c61ed0c65d5da7c0e49eb8f50aba208af8b6))
* add support for `useHead` ([#122](https://github.com/nuxt/framework/issues/122)) ([3f99bb7](https://github.com/nuxt/framework/commit/3f99bb7878a3df176b8115004acae7b90182c6d2))
* add vue-app types ([#12](https://github.com/nuxt/framework/issues/12)) ([a74b48c](https://github.com/nuxt/framework/commit/a74b48c648d2dc55adc5d47989ffdca8941e0483))
* create `nu` cli ([c9347e3](https://github.com/nuxt/framework/commit/c9347e3f5b68664007710c32e30be34bde08836b))
* improve app, fetch and support vuex5 ([5a7f516](https://github.com/nuxt/framework/commit/5a7f5164f0b4f6d3b8a2fca526f194545f6796a6))
* improve typing of config ([2122838](https://github.com/nuxt/framework/commit/212283837b248ee203f0b0459c37f2b1121a5784))
* initial support for vite bundler ([#127](https://github.com/nuxt/framework/issues/127)) ([9be2826](https://github.com/nuxt/framework/commit/9be282623cf69270fc4f28ec599c0844fa3bfaea))
* initial work for pages routing ([#113](https://github.com/nuxt/framework/issues/113)) ([a6f9fb4](https://github.com/nuxt/framework/commit/a6f9fb4c7ac4d4b90b88f5341acad9120a2fa1ee))
* migrate to nitro ([faabd1a](https://github.com/nuxt/framework/commit/faabd1ab54b4dc0af1f1ab0dfdf98206f92c7f0c))
* module utils and improvements ([#38](https://github.com/nuxt/framework/issues/38)) ([b3f3dc9](https://github.com/nuxt/framework/commit/b3f3dc94f3ef0790eea114d605b6f320dbf3f1d2))
* preliminary vue-app types ([426cf1b](https://github.com/nuxt/framework/commit/426cf1b3de893db6c6430a874a9fd57a7db3b4a2))
* prepare for npm publish ([47c738c](https://github.com/nuxt/framework/commit/47c738cd9d5d1f86f7b5671479019166408bd034))
* rewrite webpack config ([#30](https://github.com/nuxt/framework/issues/30)) ([d6ed1df](https://github.com/nuxt/framework/commit/d6ed1dfc2c3ed7bdfa7481d3e4974b12701b3fc6))
* rollup build, basic typescript support and typescript app ([e7dd27f](https://github.com/nuxt/framework/commit/e7dd27fa2a5a165d87f277188515ea8024999e3b))
* support auto import of plugins ([#169](https://github.com/nuxt/framework/issues/169)) ([bece3b8](https://github.com/nuxt/framework/commit/bece3b85abb579d0b4d42a92ee85ba2480ec3c3d))
* support document.html ([0947613](https://github.com/nuxt/framework/commit/09476134eeeb12c025618919ab9a795a680a9b30))
* typed nuxt (1) ([38e72f8](https://github.com/nuxt/framework/commit/38e72f86c2b5e891d4c86e4801cd42eb136f9cea))
* use express instead of connect ([c0e565c](https://github.com/nuxt/framework/commit/c0e565cbe7d6beecb4df760ac893c915ff67693e))
* use sigma ([#95](https://github.com/nuxt/framework/issues/95)) ([0091dba](https://github.com/nuxt/framework/commit/0091dba181e46abc617d5faf8a8c4c1338755082))
* useAsyncData ([#142](https://github.com/nuxt/framework/issues/142)) ([a870746](https://github.com/nuxt/framework/commit/a8707469f875f9426ef41d8162e6b5acda7a3fc3)), closes [#141](https://github.com/nuxt/framework/issues/141)
* **style:** add style loaders ([#50](https://github.com/nuxt/framework/issues/50)) ([232d329](https://github.com/nuxt/framework/commit/232d3298b443581dc193f3b1e7dd8f4260443720))
* **webpack:** replace optimize-css-assets-webpack-plugin with css-minimizer-webpack-plugin ([2ee8628](https://github.com/nuxt/framework/commit/2ee86286ad530b6192f10c68d409caf480933caa))
