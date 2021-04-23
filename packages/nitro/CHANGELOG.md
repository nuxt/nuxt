# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.6.1](https://github.com/nuxt/framework/compare/@nuxt/nitro@0.6.0...@nuxt/nitro@0.6.1) (2021-04-23)


### Bug Fixes

* **nitro:** avoid using fs/promises ([47c2855](https://github.com/nuxt/framework/commit/47c28551c84f025eb9f9e29bd912026f7b143279))





# [0.6.0](https://github.com/nuxt/framework/compare/@nuxt/nitro@0.5.2...@nuxt/nitro@0.6.0) (2021-04-23)


### Bug Fixes

* **nitro:** mock consola ([#106](https://github.com/nuxt/framework/issues/106)) ([4c0dba2](https://github.com/nuxt/framework/commit/4c0dba202ff0b97ee8ebef06018471cb4d4fbaf5))
* **nitro:** only serve placeholders for `publicPath` ([1b10a1f](https://github.com/nuxt/framework/commit/1b10a1f091242fba83785dea977f184a92e33757))
* **nitro:** ovrride by user input ([8f8551c](https://github.com/nuxt/framework/commit/8f8551cd67b5d135774d39f757de9d02e4e0bed4))
* **nitro:** resolve default export for assets ([49e4c03](https://github.com/nuxt/framework/commit/49e4c038b58720d6be29e3fc28359c0b33d71be2))
* **nitro:** use globalThis ([5a3f4b7](https://github.com/nuxt/framework/commit/5a3f4b780029ffab4267c02193b938dd11b1f0d1))
* issues with externals outside of rootDir ([4e18653](https://github.com/nuxt/framework/commit/4e1865358c1597cb68cc96bef2b30e2811fcd899))


### Features

* **nitro:** allow extending nitro context ([bef9f82](https://github.com/nuxt/framework/commit/bef9f82a8dd8ac916c9e9f82eafca7e916782500))





## [0.5.2](https://github.com/nuxt/framework/compare/@nuxt/nitro@0.5.1...@nuxt/nitro@0.5.2) (2021-04-17)


### Bug Fixes

* **nitro:** support vue-meta (compat) ([4dac07a](https://github.com/nuxt/framework/commit/4dac07a10459e1ae5c63361cf7a55cb2020244ff))





## [0.5.1](https://github.com/nuxt/framework/compare/@nuxt/nitro@0.5.0...@nuxt/nitro@0.5.1) (2021-04-16)


### Bug Fixes

* **nitro:** workaround for vue2 global style injection ([e5df083](https://github.com/nuxt/framework/commit/e5df083f6016219884d3d298e5d7ca2cf4a51d0b))





# [0.5.0](https://github.com/nuxt/framework/compare/@nuxt/nitro@0.4.0...@nuxt/nitro@0.5.0) (2021-04-12)


### Bug Fixes

* **nitro:** absolute external resolution ([#80](https://github.com/nuxt/framework/issues/80)) ([9a23c2a](https://github.com/nuxt/framework/commit/9a23c2a553e7a00952233ac9f2a35519047f27bc))


### Features

* **nitro:** raw loader ([#75](https://github.com/nuxt/framework/issues/75)) ([2d60e71](https://github.com/nuxt/framework/commit/2d60e71fcb612ec0d672ff031f8bfc628e842d19))
* **nitro:** server assets ([#83](https://github.com/nuxt/framework/issues/83)) ([babb70a](https://github.com/nuxt/framework/commit/babb70a4bd7f01b6b2d30d264ac83f4ae06196b5))
* **nitro:** storage support ([#76](https://github.com/nuxt/framework/issues/76)) ([31f06e9](https://github.com/nuxt/framework/commit/31f06e9f69614d2ace3c70d974ff4f946397b13d))


### Performance Improvements

* **nitro:** externalize buildDir in development ([f8cb258](https://github.com/nuxt/framework/commit/f8cb2586cfd509482705a8bc46ccdee7052dd931))





# [0.4.0](https://github.com/nuxt/framework/compare/@nuxt/nitro@0.3.0...@nuxt/nitro@0.4.0) (2021-04-09)


### Bug Fixes

* **nitro:** exclude `rootDir` from externals and reinstate automock warning ([#66](https://github.com/nuxt/framework/issues/66)) ([00c7ede](https://github.com/nuxt/framework/commit/00c7ede623728d289bb66b459b6eec184affcbfb))


### Features

* initial version of nu cli ([#54](https://github.com/nuxt/framework/issues/54)) ([a030c62](https://github.com/nuxt/framework/commit/a030c62d29ba871f94a7152c7d5fa36d4de1d3b6))





# [0.3.0](https://github.com/nuxt/framework/compare/@nuxt/nitro@0.2.4...@nuxt/nitro@0.3.0) (2021-04-08)


### Features

* basic support for netlify_builder target ([#18](https://github.com/nuxt/framework/issues/18)) ([b536ab4](https://github.com/nuxt/framework/commit/b536ab4ba7c0d8d38224e61c1f91ce528a6ba4e8))





## [0.2.4](https://github.com/nuxt/framework/compare/@nuxt/nitro@0.2.3...@nuxt/nitro@0.2.4) (2021-04-06)


### Bug Fixes

* **nitro:** add temporary workarouind for ufo resolution in nuxt2 ([f66d917](https://github.com/nuxt/framework/commit/f66d91772974fe1859130462389ada72829df377))





## [0.2.3](https://github.com/nuxt/framework/compare/@nuxt/nitro@0.2.2...@nuxt/nitro@0.2.3) (2021-04-06)


### Bug Fixes

* use `globalThis` instead of `global` ([#59](https://github.com/nuxt/framework/issues/59)) ([b12cbc5](https://github.com/nuxt/framework/commit/b12cbc5ed2f5448ba9c896a14730c09a6ee88e1d))
* **app, nitro:** fix `app:rendered` hook ([#53](https://github.com/nuxt/framework/issues/53)) ([7f97015](https://github.com/nuxt/framework/commit/7f97015c7443caacbb914ff3a0bc99149b66b3a6))





## [0.2.2](https://github.com/nuxt/framework/compare/@nuxt/nitro@0.2.1...@nuxt/nitro@0.2.2) (2021-04-04)

**Note:** Version bump only for package @nuxt/nitro





## [0.2.1](https://github.com/nuxt/framework/compare/@nuxt/nitro@0.2.0...@nuxt/nitro@0.2.1) (2021-04-04)


### Bug Fixes

* **nitro:** add back compat entry ([9c21ea5](https://github.com/nuxt/framework/commit/9c21ea52ea3571a54ec3173644f73cdc851d1fb5))
* **nitro:** add missing kit dependency ([6e1cb62](https://github.com/nuxt/framework/commit/6e1cb62231fa735c8776292e92ed07ea7aa0f01a))
* **nitro:** pass req, res to ssr context (resolves [#39](https://github.com/nuxt/framework/issues/39)) ([16cc09b](https://github.com/nuxt/framework/commit/16cc09bd76044fd24a9e6a393a79aa01f299b009))
* **nitro:** resolve alias for serverMiddleware ([c864c5a](https://github.com/nuxt/framework/commit/c864c5a30cfc38362e35ee4c7015b589d445edee))





# 0.2.0 (2021-04-04)


### Bug Fixes

* **cloudflare, lambda:** preserve query parameters in url ([#155](https://github.com/nuxt/framework/issues/155)) ([8cc836e](https://github.com/nuxt/framework/commit/8cc836ebf6b19702f961791c618a1ab6b4bb7ae4))
* **compat:** enforce nuxt generate for static target ([#148](https://github.com/nuxt/framework/issues/148)) ([fdc0ffe](https://github.com/nuxt/framework/commit/fdc0ffef8d2f3af4a82893788f5d203a93932e92))
* **dep:** pin esbuild to 0.10.x due to module breaking changes ([6fb4028](https://github.com/nuxt/framework/commit/6fb4028850ffe14c535d5f6526360fdecf9c29d4))
* allow matching dynamic page routes ([0942d72](https://github.com/nuxt/framework/commit/0942d72553c19e6ea9516470589adc0596f4ade3))
* allow numbers in dynamic webpack chunk names ([#125](https://github.com/nuxt/framework/issues/125)) ([27aef14](https://github.com/nuxt/framework/commit/27aef1489face3a60a1a3bd484b5c320605ee1fa))
* avoid overriding hooks ([5bfacf1](https://github.com/nuxt/framework/commit/5bfacf1f55b564ece5c4403ebbc98663351a71a6))
* **compat:** cannot read property setLegacyMiddleware of undefined ([#82](https://github.com/nuxt/framework/issues/82)) ([67a82a7](https://github.com/nuxt/framework/commit/67a82a7ab923bcdb328267a82d81c015ceb43bf9))
* **compat:** disable webpack sourcemap ([#84](https://github.com/nuxt/framework/issues/84)) ([1b14214](https://github.com/nuxt/framework/commit/1b142148eb367caf57e0d44e67ae92ea08f25bbb))
* **config:** always disasble server sourceMap ([#88](https://github.com/nuxt/framework/issues/88)) ([5aa3161](https://github.com/nuxt/framework/commit/5aa31613bd5384a6061b8eae84a38640ef036ad8))
* **resolveMiddleware:** remove legacy handler and path props ([5e6fb80](https://github.com/nuxt/framework/commit/5e6fb802f3f6dc6acd2405724ce567345b0afb4d))
* _interopDefault potential cjs files ([4f09b51](https://github.com/nuxt/framework/commit/4f09b514f121730c6754984743da9c13ed46d9e3))
* 404 handling for static assets ([387fa4a](https://github.com/nuxt/framework/commit/387fa4a278c5df50ef23cfd9e1e003e396a9c090))
* add `node_modules` from cwd to nodeResolve ([4685108](https://github.com/nuxt/framework/commit/4685108c16d908ffae93610da8c7e15703ee4313))
* add temp fix for browser ([37c7e89](https://github.com/nuxt/framework/commit/37c7e892d5998a513a35d4879fd969943d93f03c))
* addresses static assets/azure issues ([#49](https://github.com/nuxt/framework/issues/49)) ([9c25d68](https://github.com/nuxt/framework/commit/9c25d68511b2236fbff5b77f0ccc316b66d1885a))
* bring back nuxt3 support ([9e9b20e](https://github.com/nuxt/framework/commit/9e9b20ef90057c8fbc47a7e1e6803670b975bfc2))
* check for server webpack config ([#91](https://github.com/nuxt/framework/issues/91)) ([97efab4](https://github.com/nuxt/framework/commit/97efab427066b26df07f8795ca8ce258e25c5e80))
* cloudflare and polyfill ([cb98031](https://github.com/nuxt/framework/commit/cb98031cff942b14d71e12f751a17be165972bac))
* default value for template path ([a6936ff](https://github.com/nuxt/framework/commit/a6936ff8c6683174b1cef7df3f52f0d917d63907))
* disable external tracing for local preset ([0675191](https://github.com/nuxt/framework/commit/0675191cba1866ad839451f53539e46bd803ff28))
* disable static manifest generation (resolves [#53](https://github.com/nuxt/framework/issues/53)) ([133b44d](https://github.com/nuxt/framework/commit/133b44d3c026eea52e6fc263ce346974d36cf1ea))
* fix _interopDefault implementation ([d94aec4](https://github.com/nuxt/framework/commit/d94aec4841eab634f4014712dc9194bda0729dcc))
* force rebuild on new files being added ([#136](https://github.com/nuxt/framework/issues/136)) ([e1f409e](https://github.com/nuxt/framework/commit/e1f409ea51f85a69b9315b0bdc1e0d30b26abfe5))
* hide rollup circular and eval ([5c8ac22](https://github.com/nuxt/framework/commit/5c8ac226f1a64268b8248a21947e7feaf40c451e))
* lazy is true by default ([68fc208](https://github.com/nuxt/framework/commit/68fc2082994c641a195c18d49d1ac861c2dc369e))
* load webpack modules synchronously with `require` ([#104](https://github.com/nuxt/framework/issues/104)) ([c1cd37d](https://github.com/nuxt/framework/commit/c1cd37d8c5134a7d71ff3fcee83ba382575eaac4))
* promisify: false support ([82f6db6](https://github.com/nuxt/framework/commit/82f6db6bcaa90ea4a9477ae67696b8b2e8be4ce9))
* remove runtime/ prefix ([531f6b1](https://github.com/nuxt/framework/commit/531f6b1e083baebd0763bbfd5a1c2bcc7ba0b8f9))
* silent proxy errors ([239c69d](https://github.com/nuxt/framework/commit/239c69d92afc56821158670053e7fc4c5114adf1))
* skip static dir if not exists ([6de295c](https://github.com/nuxt/framework/commit/6de295cc9f8f0c24e4e93068f48bfe877c9c1ba8))
* static asset handling with leading slash ([fd0be27](https://github.com/nuxt/framework/commit/fd0be27f0c04a8891b15c9dbb217fafe36cb88e8))
* temporary disable auto mock plugin ([4890205](https://github.com/nuxt/framework/commit/4890205b6eae11cea5f6e393074f5882f0e34d65))
* temporary remove dev warning for pwa module ([#40](https://github.com/nuxt/framework/issues/40)) ([3c9bb27](https://github.com/nuxt/framework/commit/3c9bb27148457a186f9caaee001c072d16689c50))
* update documentPath with updated buildDir ([#70](https://github.com/nuxt/framework/issues/70)) ([2186d95](https://github.com/nuxt/framework/commit/2186d953d0f828cbda1cd6960646ce6c9d5bbc49))
* update node-resolve options ([0a2f9a3](https://github.com/nuxt/framework/commit/0a2f9a39495ea432527498011cec7f79e55f7b3f))
* use allowlist approach to chunk name ([#101](https://github.com/nuxt/framework/issues/101)) ([c76bd35](https://github.com/nuxt/framework/commit/c76bd35c29f005e4efcb10dd5c0e1c355f80cced)), closes [#93](https://github.com/nuxt/framework/issues/93)
* use globalThis for client plugin ([7096119](https://github.com/nuxt/framework/commit/709611941be45c41e801d7ecfa3b9dfeafcc6e44))
* **rollup:** dirnames not generate a sourcemap for the transformation ([#83](https://github.com/nuxt/framework/issues/83)) ([2d0ff10](https://github.com/nuxt/framework/commit/2d0ff108924feec6cf21a6143d2f4acd45093faa))
* use connect for dev server due to loading-screen issue ([e56178a](https://github.com/nuxt/framework/commit/e56178a8727470d861d00afdbf16718da1405f40))
* **vercel:** entry should export handle as default ([d3d3c0a](https://github.com/nuxt/framework/commit/d3d3c0a2ea1f8e4a2fd7106ca74cf75378dcdb86))
* **vercel:** remove index.js from serverDir ([15fff51](https://github.com/nuxt/framework/commit/15fff5117fc4ad54f8b934b99a246dbba4883bf6))
* add critical css ([1a6a4cb](https://github.com/nuxt/framework/commit/1a6a4cb248db50b388883f94255799283b997c82))
* add generate.routes and disable crawler ([a4952a0](https://github.com/nuxt/framework/commit/a4952a057cb5d5172612371ffb93db82087f7ab0))
* add hack for encoding ([5361558](https://github.com/nuxt/framework/commit/536155825b6410c33d2a848cd8931d02ea6079cb))
* add more types ([#16](https://github.com/nuxt/framework/issues/16)) ([fc0934d](https://github.com/nuxt/framework/commit/fc0934dd0c8ff9fcd1eeb4c595f1582a42dd4440))
* add prefix to dynamic imports name ([#5](https://github.com/nuxt/framework/issues/5)) ([d4624ab](https://github.com/nuxt/framework/commit/d4624abfb95e529a93af88372a2f6c71f0495e17))
* always mock generic dependencies ([b65cd78](https://github.com/nuxt/framework/commit/b65cd7862a829df4de6cc356037499765683b42f))
* configurable publicPath (closes [#21](https://github.com/nuxt/framework/issues/21)) ([aff2372](https://github.com/nuxt/framework/commit/aff23726500de3050ba050bf0460eda2ed935b5e))
* disable cleanTargetDir for vercel ([e874d4d](https://github.com/nuxt/framework/commit/e874d4db59479eb30257cc647a580e4764df2349))
* don't set _registeredComponents ([ef4e544](https://github.com/nuxt/framework/commit/ef4e5443aa874af840fed851b1b1f4a1cf18f80e))
* ensure builds are relative to buildDir ([a9a262f](https://github.com/nuxt/framework/commit/a9a262f258ec5acaeb1c2914b398d9a596f97cd1))
* exec require before return ([e3609b6](https://github.com/nuxt/framework/commit/e3609b6d8a1e6a6274270e582e0422ff197a8785))
* extend routes from serverless.static ([4185ec8](https://github.com/nuxt/framework/commit/4185ec896fd70fa1831d7b88d39a646bab4f075a))
* fix issues with router.base support ([4f74119](https://github.com/nuxt/framework/commit/4f7411973978a992e76806db1eea1f20715d1a22))
* fix mocks and disable buffer since is unnecessary ([c8f4957](https://github.com/nuxt/framework/commit/c8f495752063a19c11d624012897a5079a1571e7))
* fix worker polyfill by adding performance ([72b877f](https://github.com/nuxt/framework/commit/72b877fe7cab5ef831bfe334f2ae551724510100))
* handle if serverless is not set in config ([d6aea1e](https://github.com/nuxt/framework/commit/d6aea1e0dfbfbd6442aba0e3091278c381831c1b))
* host ~> hostname ([bec1c8e](https://github.com/nuxt/framework/commit/bec1c8edfa661f6b75e005a6858b554ed1ba41d5))
* ignore close listeners ([bde0c7c](https://github.com/nuxt/framework/commit/bde0c7c286c28a3dd4eeae9510ed9dc47f18711b))
* move hrtime polyfill to timing plugin ([047761f](https://github.com/nuxt/framework/commit/047761f8b7719d6aac8e318022b4d04dfe479a0f))
* resolve chunksDirName based on outNames dirname (vercel) ([e16aee4](https://github.com/nuxt/framework/commit/e16aee43ba871de01579a294031508774e5cd6ce))
* static dir is in `srcDir` ([#37](https://github.com/nuxt/framework/issues/37)) ([16451a3](https://github.com/nuxt/framework/commit/16451a35886224d83906e1d9d8637ebd93d2777b))
* support both targets by adding prepare step ([b15d16a](https://github.com/nuxt/framework/commit/b15d16abd3b7aa9bdb29f83f1e7a842c3189af72))
* use dist for netlify as default ([f638a44](https://github.com/nuxt/framework/commit/f638a445687af08da8b281c1efbd153856696873))
* **browser:** 400.html ~> 404.html ([2e329d0](https://github.com/nuxt/framework/commit/2e329d040321c4d1228dabddd93dcb7758582b74))
* **timing:** include helpers only in entries ([f2c1589](https://github.com/nuxt/framework/commit/f2c1589472ab62d806d9db5e962b3b4cb004fd7e))
* only generate .sls directory when needed ([696556a](https://github.com/nuxt/framework/commit/696556aef8ab8aed41c450b299432a87d8b7af96))
* resolve runtime provided dependencies ([16141ef](https://github.com/nuxt/framework/commit/16141efe25ae70485f96f138c5a655ae97182cac))
* use html.contents ([374487e](https://github.com/nuxt/framework/commit/374487ea291b4d7ff14e29a62eec433ca7a75a8a))
* use native fetch when node is disabled ([a5e70eb](https://github.com/nuxt/framework/commit/a5e70eb4b0bc1442c127ab5fcd7034c3ca91aa3c))
* use same global to inject process.hrtime ([e8f52bd](https://github.com/nuxt/framework/commit/e8f52bd383d173156d831afd92703931be6dfa7c))
* **vercel:** add `/index`  suffix to dst ([2c4b857](https://github.com/nuxt/framework/commit/2c4b8578934c65655acd72fb1161394c0eec9a4f))
* **vercel:** add api prefix ([1df092d](https://github.com/nuxt/framework/commit/1df092d08e062947b356224fdc80f591f7c9ca07))
* **vercel:** add missing node segment ([a6c4a7e](https://github.com/nuxt/framework/commit/a6c4a7e2cde16cab57083f654caf3247d83a8786))
* **vercel:** generate to config/routes.json ([7347e8e](https://github.com/nuxt/framework/commit/7347e8ebda675ce9adf2a78a2e891651295cb6fd))
* **worker:** smaller and working hrtime polyfill ([2a6d4f3](https://github.com/nuxt/framework/commit/2a6d4f38d036c5b4bbf1fba6264f3d71d19454c5))
* **worker:** wrap polyfill to iife ([eaf4603](https://github.com/nuxt/framework/commit/eaf4603d9ce804d482d67ce7165f09e17f2cb689))


### Features

* add $fetch to client ([a7d1587](https://github.com/nuxt/framework/commit/a7d158798c026fd3a072d275eecd8d9427a77fea))
* add azure functions preset ([#45](https://github.com/nuxt/framework/issues/45)) ([976dff7](https://github.com/nuxt/framework/commit/976dff7ce1e5021e64acc8fca71c4e305b2c58ad))
* add firebase preset ([#100](https://github.com/nuxt/framework/issues/100)) ([9390acc](https://github.com/nuxt/framework/commit/9390acce83b9f76dcd23aa9b547a824dc74e0c8d))
* add hint to dynamic require for netlify ([f7378db](https://github.com/nuxt/framework/commit/f7378db9e0ef72c860879c04459a0fd92d846a66))
* add support for Azure static web apps ([#92](https://github.com/nuxt/framework/issues/92)) ([31a9bc2](https://github.com/nuxt/framework/commit/31a9bc2d183d77cba566d27c2f687a1d9d11f2dd))
* automatically mock unresolved externals ([b5b585c](https://github.com/nuxt/framework/commit/b5b585c0c80fac688947433df0a73d5d6a823397))
* better error handler ([7e682ed](https://github.com/nuxt/framework/commit/7e682ed66344814b74162b00f91b5163d375277c))
* better process polyfill ([989f681](https://github.com/nuxt/framework/commit/989f6811c2d20255cf568265e9889604f8baa50d))
* detect target ([ddccc9c](https://github.com/nuxt/framework/commit/ddccc9cb7848e454fc40e0ed5b9674c932732e9c))
* dynamic chunk importer ([ad4fc18](https://github.com/nuxt/framework/commit/ad4fc18ab8b1fa516c9d9d433a01366c358b2b6c))
* dynamic-require rollup plugin ([cbae59a](https://github.com/nuxt/framework/commit/cbae59a88ba756c7b609544439d20a0e2026d9c9))
* enable externals.trace by default ([19e6542](https://github.com/nuxt/framework/commit/19e6542d273a9595c05b8214004da6be0f734793))
* expose process.env.SIGMA_PRESET ([02a66ab](https://github.com/nuxt/framework/commit/02a66ab40c6e1e438ba00c48c681a4711f18a23a))
* generate meaningful chunkNames ([aa71b51](https://github.com/nuxt/framework/commit/aa71b515383d12870b81fe858b3fde553b4186a8))
* generate public (dist/) ([0245bd6](https://github.com/nuxt/framework/commit/0245bd65de00841ca898bb15bcadb15420af58e2))
* improve mocking ([2384b82](https://github.com/nuxt/framework/commit/2384b8269ed4a133670a2c2575bad1d7d75788a8))
* improve mocks ([6ff7c7e](https://github.com/nuxt/framework/commit/6ff7c7e02eff6c0b82712c7f7263b06eaae7f9a4))
* improve types ([#6](https://github.com/nuxt/framework/issues/6)) ([dfdd466](https://github.com/nuxt/framework/commit/dfdd466270899a1eaa8e8551c0d18c831a4ebcf9))
* improved env support ([227e04b](https://github.com/nuxt/framework/commit/227e04b92e3bfa2f00054f5f973296104039546a))
* improved externals and experimental trace with vercel/nft ([5bbdc2b](https://github.com/nuxt/framework/commit/5bbdc2bc65043c66b07cb07a230c564c4e379ee2))
* improved sever timing ([dbce482](https://github.com/nuxt/framework/commit/dbce482b7e2cb873d038be0ba4dae746c4385f66))
* inject sw script to pages ([6e16783](https://github.com/nuxt/framework/commit/6e1678316eb80f27dcd15c3e8006d1c8b7685e7f))
* integrate $fetch with ohmyfetch ([2c83f6e](https://github.com/nuxt/framework/commit/2c83f6ea6afd79ff9ba59a89d4ed669cb44c0a6c))
* make browser target working again ([9d02552](https://github.com/nuxt/framework/commit/9d02552c3c1f3648a3c88ec8bbdb192cf39ff327))
* make cloudflare working ([5b83142](https://github.com/nuxt/framework/commit/5b8314245ce335939c22317261278ad0a283d535))
* mock debug ([#118](https://github.com/nuxt/framework/issues/118)) ([65229ff](https://github.com/nuxt/framework/commit/65229ffb045e1991e1595b149341dc57135ed52a)), closes [#97](https://github.com/nuxt/framework/issues/97)
* mock mime packages and fix v1 compat ([2ad4a81](https://github.com/nuxt/framework/commit/2ad4a81362e23e34b6a249f9c80edf92ac4a3d9c))
* mock stream ([040af4e](https://github.com/nuxt/framework/commit/040af4ea4ed5f09211da6a977dcda65e87179848))
* module utils and improvements ([#38](https://github.com/nuxt/framework/issues/38)) ([b3f3dc9](https://github.com/nuxt/framework/commit/b3f3dc94f3ef0790eea114d605b6f320dbf3f1d2))
* natively parse and import async webpack chunks ([609796a](https://github.com/nuxt/framework/commit/609796a9449fec2ac54940ce26d95d2841909ef7))
* rewrite as nuxt module ([486c881](https://github.com/nuxt/framework/commit/486c881b2dd1c1e547f31cf8babc68e259982df0))
* serve-placeholder ([0b886cf](https://github.com/nuxt/framework/commit/0b886cf57ff2f55c693507d343c28e4979aa7b7d))
* serveStatic ([#47](https://github.com/nuxt/framework/issues/47)) ([a9b9d19](https://github.com/nuxt/framework/commit/a9b9d19e6644d63ab54af5e7705971433fa5d426))
* show fs tree for output ([6875d55](https://github.com/nuxt/framework/commit/6875d5535bf384007dfa01860302e18f073b2889))
* sigma.client ([abf65f2](https://github.com/nuxt/framework/commit/abf65f21761bbff7ace8d4871c94bc07448266c9))
* sourcemap support ([daf0c3e](https://github.com/nuxt/framework/commit/daf0c3e6a577cade2f1ed4620d3a6ed520521e42))
* ssr with service worker ([2dbaae6](https://github.com/nuxt/framework/commit/2dbaae6b7d55ff352ac131ffc08220e2c16d2e44))
* support dynamic chunks, lazy middleware and cjs target ([1e34041](https://github.com/nuxt/framework/commit/1e34041e8d4d16c63735bdeb06e1e2ae22f0b5dc))
* support runtimeConfig (closes [#43](https://github.com/nuxt/framework/issues/43)) ([ca015de](https://github.com/nuxt/framework/commit/ca015deda60b45d2bb7f48343a2815bad74ac9ef))
* support server directory ([#132](https://github.com/nuxt/framework/issues/132)) ([85da52d](https://github.com/nuxt/framework/commit/85da52d390cd2e8156ec7a5841ce8884acfa5b55))
* support serverMiddleware ([75ed762](https://github.com/nuxt/framework/commit/75ed76219266e6017849111a63d977eccad6423d))
* support ssrContext.head ([6e9be0e](https://github.com/nuxt/framework/commit/6e9be0eece336c28ce259d4463dda0c443675fb9))
* support staticAssetsBase ([415db06](https://github.com/nuxt/framework/commit/415db060b044e827057f6b0327c7c8d674c2a093))
* support targer functions to consume nuxtOptions ([91caf2c](https://github.com/nuxt/framework/commit/91caf2c4709a5cb0687bf71ec37248acbd773e02))
* support typescript via esbuild (closes [#42](https://github.com/nuxt/framework/issues/42)) ([7ae8483](https://github.com/nuxt/framework/commit/7ae8483d21f3f5a229e48a9aabb5d1c0402d4045))
* support universalFetch during generate ([9e638e9](https://github.com/nuxt/framework/commit/9e638e96fab064324c29f1c0b4968e6cbabf176b))
* swtich to h2 stack for dev server ([921bb15](https://github.com/nuxt/framework/commit/921bb15130e37fb81a7fc8f1c1f9f45eeddecd7c))
* timing plugin and Server-Timing ([740bf07](https://github.com/nuxt/framework/commit/740bf073b2bec66b36c2fc685556eb3d80b5df90))
* update preset options ([8a22fa3](https://github.com/nuxt/framework/commit/8a22fa333ef00994ea44c85a7b9ba37fd02270cf))
* update vercel and improve internals ([c7b88de](https://github.com/nuxt/framework/commit/c7b88defa47450612961e90e531dd7519ab47588))
* use h2@10 ([cd0dd00](https://github.com/nuxt/framework/commit/cd0dd009e0c1d62f8c770961f69057a09a69b524))
* **browser:** inject script to js template ([04a25fc](https://github.com/nuxt/framework/commit/04a25fc527a19763887d2dfaae08465a2b9907a2))
* **worker:** support process.hrtime ([4b831fb](https://github.com/nuxt/framework/commit/4b831fbd8d3b06d1699c361615ff85ed4f682d85))
* use dynamic require for node targets ([114b540](https://github.com/nuxt/framework/commit/114b5406acfebb04b5a4fa1823a12cfc70f3f889))
* whitelist static routes ([e050556](https://github.com/nuxt/framework/commit/e0505568aa81fed775f7c156289457b2e9020bf6))
* working cloudflare with vue2 and async chunks ([e6fa415](https://github.com/nuxt/framework/commit/e6fa415e5a4a97dadd9ff7aa3339952c9f25dbe0))


### Performance Improvements

* short circuit window type to recuce bundle size ([bda5805](https://github.com/nuxt/framework/commit/bda5805b2d8676cb3c1d47381534e955017557b6))
