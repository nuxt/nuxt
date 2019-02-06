# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.4.3](https://github.com/nuxt/nuxt.js/compare/v2.4.2...v2.4.3) (2019-02-06)


### Bug Fixes

* await buildDone hook ([#4955](https://github.com/nuxt/nuxt.js/issues/4955)) ([f40f3f9](https://github.com/nuxt/nuxt.js/commit/f40f3f9))
* serialize external function ([#4916](https://github.com/nuxt/nuxt.js/issues/4916)) ([14f43da](https://github.com/nuxt/nuxt.js/commit/14f43da))
* update terser-webpack-plugin to 1.2.2 ([b1a5a19](https://github.com/nuxt/nuxt.js/commit/b1a5a19))
* update webpack to 4.29.1 ([95ef1d4](https://github.com/nuxt/nuxt.js/commit/95ef1d4))


### Features

* **module:** support src as a function in addModule ([#4956](https://github.com/nuxt/nuxt.js/issues/4956)) ([e2c811a](https://github.com/nuxt/nuxt.js/commit/e2c811a))





## [2.4.2](https://github.com/nuxt/nuxt.js/compare/v2.4.1...v2.4.2) (2019-01-30)

**Note:** Version bump only for package nuxt.js





## [2.4.1](https://github.com/nuxt/nuxt.js/compare/v2.4.0...v2.4.1) (2019-01-30)


### Bug Fixes

* keepAliveProps broken in <nuxt-child> ([#4521](https://github.com/nuxt/nuxt.js/issues/4521)) ([b48b220](https://github.com/nuxt/nuxt.js/commit/b48b220))





# [2.4.0](https://github.com/nuxt/nuxt.js/compare/v2.3.4...v2.4.0) (2019-01-28)


### Bug Fixes

* $nuxt is used instead of globalName ([#4743](https://github.com/nuxt/nuxt.js/issues/4743)) ([fe57a5a](https://github.com/nuxt/nuxt.js/commit/fe57a5a))
* add iron browser as modern ([#4775](https://github.com/nuxt/nuxt.js/issues/4775)) ([9eab558](https://github.com/nuxt/nuxt.js/commit/9eab558))
* add option to rewatch on path after raw fs event ([#4717](https://github.com/nuxt/nuxt.js/issues/4717)) ([9c6df49](https://github.com/nuxt/nuxt.js/commit/9c6df49))
* allow keepAliveProps for nuxt component ([#4610](https://github.com/nuxt/nuxt.js/issues/4610)) ([8dc15d0](https://github.com/nuxt/nuxt.js/commit/8dc15d0))
* allow pcss ending for webpack loader ([#4530](https://github.com/nuxt/nuxt.js/issues/4530)) ([8e0b508](https://github.com/nuxt/nuxt.js/commit/8e0b508))
* apply store HMR to whole store ([#4589](https://github.com/nuxt/nuxt.js/issues/4589)) ([81cf09c](https://github.com/nuxt/nuxt.js/commit/81cf09c))
* correct renderer.noSSR name ([6990efc](https://github.com/nuxt/nuxt.js/commit/6990efc))
* csp SHA hashes accumulate when using custom script-src rules ([#4519](https://github.com/nuxt/nuxt.js/issues/4519)) ([683dbba](https://github.com/nuxt/nuxt.js/commit/683dbba))
* detect plugin without extension ([#4579](https://github.com/nuxt/nuxt.js/issues/4579)) ([e7df65b](https://github.com/nuxt/nuxt.js/commit/e7df65b))
* hotfix for vuex hmr ([#4801](https://github.com/nuxt/nuxt.js/issues/4801)) ([5f0b34f](https://github.com/nuxt/nuxt.js/commit/5f0b34f))
* **rollup:** temporary ignore rollup-plugin-license deprecated warns ([49a7d0c](https://github.com/nuxt/nuxt.js/commit/49a7d0c))
* empty error message in dev mode ([3d990fe](https://github.com/nuxt/nuxt.js/commit/3d990fe))
* enable FriendlyErrorsPlugin when build.friendlyErrors is true ([30fef5d](https://github.com/nuxt/nuxt.js/commit/30fef5d))
* exit with proper error code on errors ([#4806](https://github.com/nuxt/nuxt.js/issues/4806)) ([a7ba73e](https://github.com/nuxt/nuxt.js/commit/a7ba73e))
* fall back to default value when `publicPath` is falsy ([#4365](https://github.com/nuxt/nuxt.js/issues/4365)) ([e0537d5](https://github.com/nuxt/nuxt.js/commit/e0537d5))
* hmr in modern mode ([#4623](https://github.com/nuxt/nuxt.js/issues/4623)) ([df9b32a](https://github.com/nuxt/nuxt.js/commit/df9b32a))
* improvements for build and dev stability ([#4470](https://github.com/nuxt/nuxt.js/issues/4470)) ([fe05169](https://github.com/nuxt/nuxt.js/commit/fe05169))
* invalid plugin mode warning for all ([9b3e7be](https://github.com/nuxt/nuxt.js/commit/9b3e7be))
* keepAliveProps broken in <nuxt-child> ([#4521](https://github.com/nuxt/nuxt.js/issues/4521)) ([431cc15](https://github.com/nuxt/nuxt.js/commit/431cc15))
* loading.throttle can not be 0 ([2d74804](https://github.com/nuxt/nuxt.js/commit/2d74804))
* match subdir under node_module  in transpile ([#4850](https://github.com/nuxt/nuxt.js/issues/4850)) ([43ce8e9](https://github.com/nuxt/nuxt.js/commit/43ce8e9))
* merge route.meta into options.meta ([#4479](https://github.com/nuxt/nuxt.js/issues/4479)) ([5a8e6e4](https://github.com/nuxt/nuxt.js/commit/5a8e6e4))
* modern=true or false not work as expected ([#4378](https://github.com/nuxt/nuxt.js/issues/4378)) ([4c27088](https://github.com/nuxt/nuxt.js/commit/4c27088))
* nested-components example ([#4535](https://github.com/nuxt/nuxt.js/issues/4535)) ([6315bd7](https://github.com/nuxt/nuxt.js/commit/6315bd7))
* no false positives for plugins with index.js ([#4714](https://github.com/nuxt/nuxt.js/issues/4714)) ([eef2af3](https://github.com/nuxt/nuxt.js/commit/eef2af3)), closes [#4713](https://github.com/nuxt/nuxt.js/issues/4713)
* No need to use process.client here ([be5e057](https://github.com/nuxt/nuxt.js/commit/be5e057))
* **builder:** add lodash inside templates ([#4368](https://github.com/nuxt/nuxt.js/issues/4368)) ([27e79be](https://github.com/nuxt/nuxt.js/commit/27e79be))
* **builder:** js layout ([#4701](https://github.com/nuxt/nuxt.js/issues/4701)) ([af76e07](https://github.com/nuxt/nuxt.js/commit/af76e07))
* **builder:** layouts condition ([#4641](https://github.com/nuxt/nuxt.js/issues/4641)) ([6436e3b](https://github.com/nuxt/nuxt.js/commit/6436e3b))
* **builder, module:** addLayout and nuxt.config precedence over auto-scanned layouts ([#4702](https://github.com/nuxt/nuxt.js/issues/4702)) ([f85ac94](https://github.com/nuxt/nuxt.js/commit/f85ac94))
* **ci:** [release] manually does not work ([052512e](https://github.com/nuxt/nuxt.js/commit/052512e))
* **ci:** deprecated --skip-git has been replaced by --no-git-tag-version --no-push ([056704f](https://github.com/nuxt/nuxt.js/commit/056704f))
* **ci:** env can not be in workflow ([0e9eca2](https://github.com/nuxt/nuxt.js/commit/0e9eca2))
* **ci:** env in circle is not executable [release] ([a4c503b](https://github.com/nuxt/nuxt.js/commit/a4c503b))
* **ci:** reduce jest workers i CircleCI ([5ec0c8d](https://github.com/nuxt/nuxt.js/commit/5ec0c8d))
* **ci:** release edge with push and tag ([678b4ab](https://github.com/nuxt/nuxt.js/commit/678b4ab))
* **ci:** release is ignored in all commits ([d7bd99e](https://github.com/nuxt/nuxt.js/commit/d7bd99e))
* **ci:** release is ignored in all commits ([b3ff7a1](https://github.com/nuxt/nuxt.js/commit/b3ff7a1))
* **ci:** run in bound for now ([89f097e](https://github.com/nuxt/nuxt.js/commit/89f097e))
* **ci:** setupFilesAfterEnv is array ([6d8da0e](https://github.com/nuxt/nuxt.js/commit/6d8da0e))
* **ci:** support skip release in commit body ([4eff50f](https://github.com/nuxt/nuxt.js/commit/4eff50f))
* **ci:** swap COMMIT_MSG between commit and nightly release ([d455408](https://github.com/nuxt/nuxt.js/commit/d455408))
* **ci:** typo ([#4400](https://github.com/nuxt/nuxt.js/issues/4400)) ([b6b7c43](https://github.com/nuxt/nuxt.js/commit/b6b7c43))
* **ci:** use full message for COMMIT_MSG ([cc358b5](https://github.com/nuxt/nuxt.js/commit/cc358b5))
* **ci:** use skip-git for edge release ([5235471](https://github.com/nuxt/nuxt.js/commit/5235471))
* **circleci:** keep using --forceExit ([085ff82](https://github.com/nuxt/nuxt.js/commit/085ff82))
* **cli:** disable lerna commit and tag ([955b5d4](https://github.com/nuxt/nuxt.js/commit/955b5d4))
* **common:** remove extra [@nuxt](https://github.com/nuxt)/config dependency ([a2d4270](https://github.com/nuxt/nuxt.js/commit/a2d4270))
* **config:** define once default nuxt config filename ([#4814](https://github.com/nuxt/nuxt.js/issues/4814)) ([06a18ca](https://github.com/nuxt/nuxt.js/commit/06a18ca))
* **deps:** update all non-major dependencies ([#4358](https://github.com/nuxt/nuxt.js/issues/4358)) ([45fdae0](https://github.com/nuxt/nuxt.js/commit/45fdae0))
* **deps:** update dependency vue-no-ssr to ^1.1.0 ([#4372](https://github.com/nuxt/nuxt.js/issues/4372)) ([e731250](https://github.com/nuxt/nuxt.js/commit/e731250))
* **dev:** Show correct path when webpack watched files changed ([25dea5f](https://github.com/nuxt/nuxt.js/commit/25dea5f))
* **dist:** use -edge suffix to require cli ([98c1922](https://github.com/nuxt/nuxt.js/commit/98c1922))
* **edge, next:** -t ~> --tag ([2b46d3e](https://github.com/nuxt/nuxt.js/commit/2b46d3e))
* **eslint:** amp tags not support pascal case ([6a4808f](https://github.com/nuxt/nuxt.js/commit/6a4808f))
* **example:** lint error ([ccf3264](https://github.com/nuxt/nuxt.js/commit/ccf3264))
* **examples:** add pug dependencies ([#4824](https://github.com/nuxt/nuxt.js/issues/4824)) ([4b32144](https://github.com/nuxt/nuxt.js/commit/4b32144))
* **examples:** deps [skip ci] ([#4782](https://github.com/nuxt/nuxt.js/issues/4782)) ([f70610b](https://github.com/nuxt/nuxt.js/commit/f70610b))
* **examples:** deps [skip ci] ([#4827](https://github.com/nuxt/nuxt.js/issues/4827)) ([6542dff](https://github.com/nuxt/nuxt.js/commit/6542dff))
* **examples:** fix deps on codesandbox ([#4828](https://github.com/nuxt/nuxt.js/issues/4828)) ([ee7ad77](https://github.com/nuxt/nuxt.js/commit/ee7ad77))
* **examples:** Ugrade `vue-property-decorator` in typescript examples ([#4767](https://github.com/nuxt/nuxt.js/issues/4767)) ([73507b8](https://github.com/nuxt/nuxt.js/commit/73507b8))
* **examples:** Update config for better mobile handling ([3b7ac3c](https://github.com/nuxt/nuxt.js/commit/3b7ac3c))
* **examples:** use testURL and module names ([#4777](https://github.com/nuxt/nuxt.js/issues/4777)) ([c83bcb0](https://github.com/nuxt/nuxt.js/commit/c83bcb0))
* **exmaple:** typescript example ([7cf9f80](https://github.com/nuxt/nuxt.js/commit/7cf9f80))
* **layout-middleware:** Fix issue [#4724](https://github.com/nuxt/nuxt.js/issues/4724) ([521ac20](https://github.com/nuxt/nuxt.js/commit/521ac20))
* **nuxt-start:** include all vue-app dependencies to prevent breaking changes ([c664e3d](https://github.com/nuxt/nuxt.js/commit/c664e3d))
* **pkg:** add serialize-javascript to common/package.json ([#4565](https://github.com/nuxt/nuxt.js/issues/4565)) ([6b95eff](https://github.com/nuxt/nuxt.js/commit/6b95eff))
* **pkg:** move opencollective dependency nuxt and nuxt-legacy ([#4415](https://github.com/nuxt/nuxt.js/issues/4415)) ([f680e36](https://github.com/nuxt/nuxt.js/commit/f680e36))
* **pkg:** preferConst -> output.preferConst ([7fc4ba2](https://github.com/nuxt/nuxt.js/commit/7fc4ba2))
* **pkg:** skip invalid workspace packages ([ba50d3b](https://github.com/nuxt/nuxt.js/commit/ba50d3b))
* **progress-bar:** allow 0 for values and remove duplicate defaults ([#4397](https://github.com/nuxt/nuxt.js/issues/4397)) ([ecdc7bc](https://github.com/nuxt/nuxt.js/commit/ecdc7bc))
* **renderer:** ignore invalid sourcemaps ([4b643b9](https://github.com/nuxt/nuxt.js/commit/4b643b9))
* **resolver:** resolve dir if no index found [#4568](https://github.com/nuxt/nuxt.js/issues/4568) ([#4569](https://github.com/nuxt/nuxt.js/issues/4569)) ([85b5359](https://github.com/nuxt/nuxt.js/commit/85b5359))
* **resolver:** resolvedPath/index.[ext] resolution ([#4548](https://github.com/nuxt/nuxt.js/issues/4548)) ([b413bc1](https://github.com/nuxt/nuxt.js/commit/b413bc1))
* **rollup:** set correct output options ([fc1ab1e](https://github.com/nuxt/nuxt.js/commit/fc1ab1e))
* **scrollBehavior:** emit triggerScroll event after changing layer ([#4399](https://github.com/nuxt/nuxt.js/issues/4399)) ([330301c](https://github.com/nuxt/nuxt.js/commit/330301c)), closes [#4080](https://github.com/nuxt/nuxt.js/issues/4080)
* **server:** allow listening on number 0 port ([#4781](https://github.com/nuxt/nuxt.js/issues/4781)) ([602cf12](https://github.com/nuxt/nuxt.js/commit/602cf12))
* **server:** allow rendering urls with unicode characters ([#4512](https://github.com/nuxt/nuxt.js/issues/4512)) ([c3128ea](https://github.com/nuxt/nuxt.js/commit/c3128ea))
* **server:** Cannot read property client of null when webpackHMR & restarting Nuxt ([8a200f7](https://github.com/nuxt/nuxt.js/commit/8a200f7))
* **server:** delete all non-js assets ([6589670](https://github.com/nuxt/nuxt.js/commit/6589670))
* **server:** process browser version with non semver versions ([#4673](https://github.com/nuxt/nuxt.js/issues/4673)) ([d3b9396](https://github.com/nuxt/nuxt.js/commit/d3b9396))
* **server, jsdom:** fix timeout error message ([#4412](https://github.com/nuxt/nuxt.js/issues/4412)) ([ab6367b](https://github.com/nuxt/nuxt.js/commit/ab6367b))
* **server, vue-app:** allow unicode page names ([#4402](https://github.com/nuxt/nuxt.js/issues/4402)) ([949785f](https://github.com/nuxt/nuxt.js/commit/949785f))
* **test:** downgrade jest to 23 ([d88e448](https://github.com/nuxt/nuxt.js/commit/d88e448))
* **test:** fallback to config if no config.default ([2f2ec7a](https://github.com/nuxt/nuxt.js/commit/2f2ec7a))
* **test:** jest describe.skip does not work fine ([d0aadd4](https://github.com/nuxt/nuxt.js/commit/d0aadd4))
* **test:** remove local paths ([d02eb2f](https://github.com/nuxt/nuxt.js/commit/d02eb2f))
* **test:** typescirpt modern mode only check once ([70775e1](https://github.com/nuxt/nuxt.js/commit/70775e1))
* **test:** wrong route in error-handler-object test ([#4363](https://github.com/nuxt/nuxt.js/issues/4363)) ([0db1f26](https://github.com/nuxt/nuxt.js/commit/0db1f26))
* **test/utils:** check both ts and js for nuxt.config ([5b66afc](https://github.com/nuxt/nuxt.js/commit/5b66afc))
* **ts:** Add missing `loading` property to Component options ([#4786](https://github.com/nuxt/nuxt.js/issues/4786)) ([db4001d](https://github.com/nuxt/nuxt.js/commit/db4001d))
* **ts:** better `tsconfig.json` handling & improve tests ([#4856](https://github.com/nuxt/nuxt.js/issues/4856)) ([f18ce4e](https://github.com/nuxt/nuxt.js/commit/f18ce4e))
* **ts:** fix `$nuxt.$loading` typedefs ([#4778](https://github.com/nuxt/nuxt.js/issues/4778)) ([6694cf7](https://github.com/nuxt/nuxt.js/commit/6694cf7))
* **ts:** fix default `tsconfig.json` ([#4842](https://github.com/nuxt/nuxt.js/issues/4842)) ([c39cf84](https://github.com/nuxt/nuxt.js/commit/c39cf84))
* **ts:** fix missing process type definitions and refactor types tests ([#4798](https://github.com/nuxt/nuxt.js/issues/4798)) ([45afc3f](https://github.com/nuxt/nuxt.js/commit/45afc3f))
* **ts:** fix nuxt-ts binary when running nuxt commands ([#4844](https://github.com/nuxt/nuxt.js/issues/4844)) ([6e60aa4](https://github.com/nuxt/nuxt.js/commit/6e60aa4))
* **ts:** keep baseUrl property in generated tsconfig.json ([#4843](https://github.com/nuxt/nuxt.js/issues/4843)) ([55dc7f4](https://github.com/nuxt/nuxt.js/commit/55dc7f4))
* thread-loader slow building ([4fb220c](https://github.com/nuxt/nuxt.js/commit/4fb220c))
* **ts:** missing `tsconfig.json` on npm published version ([#4840](https://github.com/nuxt/nuxt.js/issues/4840)) ([e57c20a](https://github.com/nuxt/nuxt.js/commit/e57c20a))
* **ts:** prevent checking types twice in modern mode & use consola as logger ([#4803](https://github.com/nuxt/nuxt.js/issues/4803)) ([b202361](https://github.com/nuxt/nuxt.js/commit/b202361))
* **ts:** set ts-node register compilerOptions.module to 'commonjs' ([#4752](https://github.com/nuxt/nuxt.js/issues/4752)) ([e22e14b](https://github.com/nuxt/nuxt.js/commit/e22e14b))
* watch custom patterns only when it exists ([#4823](https://github.com/nuxt/nuxt.js/issues/4823)) ([3966b26](https://github.com/nuxt/nuxt.js/commit/3966b26))
* **ts:** switch from babel preset to ts-loader ([#4563](https://github.com/nuxt/nuxt.js/issues/4563)) ([75e3df6](https://github.com/nuxt/nuxt.js/commit/75e3df6))
* **vue-app:** add type definition for `ComponentOptions.middleware` ([#4531](https://github.com/nuxt/nuxt.js/issues/4531)) ([da0a379](https://github.com/nuxt/nuxt.js/commit/da0a379))
* **vue-app:** allow passing custom props to error function ([#4462](https://github.com/nuxt/nuxt.js/issues/4462)) ([a6fed0a](https://github.com/nuxt/nuxt.js/commit/a6fed0a)), closes [#4460](https://github.com/nuxt/nuxt.js/issues/4460)
* require serverMiddleware object with path and handler ([#4656](https://github.com/nuxt/nuxt.js/issues/4656)) ([8786ff7](https://github.com/nuxt/nuxt.js/commit/8786ff7))
* **vue-app:** Call Vue.config.errorHandler instead of simply logging the error ([6c4280f](https://github.com/nuxt/nuxt.js/commit/6c4280f))
* **vue-app:** Fix default error handler in production ([96892c5](https://github.com/nuxt/nuxt.js/commit/96892c5))
* **vue-app:** Fix route meta to handle order ([45be638](https://github.com/nuxt/nuxt.js/commit/45be638))
* **vue-app:** Fix test on size-limit ([4a77de8](https://github.com/nuxt/nuxt.js/commit/4a77de8))
* **vue-app:** Fix Vuex HMR & refactor for better modules usage ([#4791](https://github.com/nuxt/nuxt.js/issues/4791)) ([deadc48](https://github.com/nuxt/nuxt.js/commit/deadc48))
* **vue-app:** router.meta is null on extendRoutes([#4478](https://github.com/nuxt/nuxt.js/issues/4478)) ([e2ab1b4](https://github.com/nuxt/nuxt.js/commit/e2ab1b4)), closes [#4154](https://github.com/nuxt/nuxt.js/issues/4154)
* Vue.component(RouterLink) is undefined in vue-router 3.0.0 ([#4668](https://github.com/nuxt/nuxt.js/issues/4668)) ([7ff4058](https://github.com/nuxt/nuxt.js/commit/7ff4058))
* **vue-app:** Set window. equals to window.{globalName} when defined ([951e745](https://github.com/nuxt/nuxt.js/commit/951e745))
* **vue-renderer:** improve ready handling ([#4511](https://github.com/nuxt/nuxt.js/issues/4511)) ([f0cb654](https://github.com/nuxt/nuxt.js/commit/f0cb654))
* **vue-renderer:** parse JSON values before passing to bundle-renderer ([c0721c0](https://github.com/nuxt/nuxt.js/commit/c0721c0)), closes [#4439](https://github.com/nuxt/nuxt.js/issues/4439)
* server build failed in dev mode ([89f8866](https://github.com/nuxt/nuxt.js/commit/89f8866))
* **webpack:** allow changing devtool with extend ([#4515](https://github.com/nuxt/nuxt.js/issues/4515)) ([33edef2](https://github.com/nuxt/nuxt.js/commit/33edef2))
* not use deprecated option esm in resolver ([5f6361f](https://github.com/nuxt/nuxt.js/commit/5f6361f))
* offer a new port and listen if already used, use consola on server error ([#4428](https://github.com/nuxt/nuxt.js/issues/4428)) ([1d78027](https://github.com/nuxt/nuxt.js/commit/1d78027))
* plugins for modern mode ([#4659](https://github.com/nuxt/nuxt.js/issues/4659)) ([867e8e1](https://github.com/nuxt/nuxt.js/commit/867e8e1))
* prevent matching native statements in serializeFunction ([#4585](https://github.com/nuxt/nuxt.js/issues/4585)) ([5b58272](https://github.com/nuxt/nuxt.js/commit/5b58272))
* properly serialize head functions ([#4558](https://github.com/nuxt/nuxt.js/issues/4558)) ([7831e57](https://github.com/nuxt/nuxt.js/commit/7831e57)), closes [#4079](https://github.com/nuxt/nuxt.js/issues/4079)
* remove unnecessary isDev in template/server ([a51ba8d](https://github.com/nuxt/nuxt.js/commit/a51ba8d))
* replace nuxtDir with module.paths ([#4448](https://github.com/nuxt/nuxt.js/issues/4448)) ([d66e1ec](https://github.com/nuxt/nuxt.js/commit/d66e1ec))
* require postcss module via resolver ([#4737](https://github.com/nuxt/nuxt.js/issues/4737)) ([4b9e8e7](https://github.com/nuxt/nuxt.js/commit/4b9e8e7))
* router Expected "0" to be defined ([#4394](https://github.com/nuxt/nuxt.js/issues/4394)) ([39b1b8e](https://github.com/nuxt/nuxt.js/commit/39b1b8e))
* SafariFix is not injected in client modern mode ([ecf76d9](https://github.com/nuxt/nuxt.js/commit/ecf76d9))
* tests failed in windows ([8163a9e](https://github.com/nuxt/nuxt.js/commit/8163a9e))
* thread-loader memory leak ([d34a9e2](https://github.com/nuxt/nuxt.js/commit/d34a9e2))
* undefined script in modern mode ([0a21d4b](https://github.com/nuxt/nuxt.js/commit/0a21d4b))
* **webpack:** deepClone before calling extendConfig ([#4464](https://github.com/nuxt/nuxt.js/issues/4464)) ([06ddfbb](https://github.com/nuxt/nuxt.js/commit/06ddfbb))
* **webpack:** prevent terser mangling html/vue reserved tags ([#4821](https://github.com/nuxt/nuxt.js/issues/4821)) ([6a68f4e](https://github.com/nuxt/nuxt.js/commit/6a68f4e))
* use case insensitive regex for webpack loader rules ([#4728](https://github.com/nuxt/nuxt.js/issues/4728)) ([68d8d54](https://github.com/nuxt/nuxt.js/commit/68d8d54))
* use triple equals in loading.throttle [release] ([e77c2db](https://github.com/nuxt/nuxt.js/commit/e77c2db))
* wait error hook ([36ca945](https://github.com/nuxt/nuxt.js/commit/36ca945))
* wrong devMiddleware in non-modern dev mode ([3515115](https://github.com/nuxt/nuxt.js/commit/3515115))
* wrong type checking for loading.duration ([0c15b29](https://github.com/nuxt/nuxt.js/commit/0c15b29))


### Features

* **builder:** optional typescript support ([#4557](https://github.com/nuxt/nuxt.js/issues/4557)) ([7145c1a](https://github.com/nuxt/nuxt.js/commit/7145c1a))
* **builder:** validate vue-app dependencies and suggest fix ([#4669](https://github.com/nuxt/nuxt.js/issues/4669)) ([7dd33fe](https://github.com/nuxt/nuxt.js/commit/7dd33fe))
* **ci:** disable lock bot ([8a11bb8](https://github.com/nuxt/nuxt.js/commit/8a11bb8))
* **ci:** edge@next ([#4477](https://github.com/nuxt/nuxt.js/issues/4477)) ([76c9d58](https://github.com/nuxt/nuxt.js/commit/76c9d58))
* **ci:** test typescript types ([#4802](https://github.com/nuxt/nuxt.js/issues/4802)) ([25fd1d8](https://github.com/nuxt/nuxt.js/commit/25fd1d8))
* **circleci:** add nightly build and manual releases ([ec99922](https://github.com/nuxt/nuxt.js/commit/ec99922))
* **cli:** add `--devtools` option for build and generate ([#4357](https://github.com/nuxt/nuxt.js/issues/4357)) ([e6f73b5](https://github.com/nuxt/nuxt.js/commit/e6f73b5))
* **cli:** improvements and external commands ([#4314](https://github.com/nuxt/nuxt.js/issues/4314)) ([0145551](https://github.com/nuxt/nuxt.js/commit/0145551))
* **common:** add yandex and vivaldi to modern browsers ([#4516](https://github.com/nuxt/nuxt.js/issues/4516)) ([51e4488](https://github.com/nuxt/nuxt.js/commit/51e4488))
* **modern:** auto detect modern mode ([#4422](https://github.com/nuxt/nuxt.js/issues/4422)) ([fe492d8](https://github.com/nuxt/nuxt.js/commit/fe492d8))
* **nuxt-link:** Smart prefetching and $nuxt.isOffline ([#4574](https://github.com/nuxt/nuxt.js/issues/4574)) ([f319033](https://github.com/nuxt/nuxt.js/commit/f319033))
* **nuxt-ts:** typescript support improvements ([#4750](https://github.com/nuxt/nuxt.js/issues/4750)) ([dfaffc0](https://github.com/nuxt/nuxt.js/commit/dfaffc0))
* **router:** custom route name splitter ([#4598](https://github.com/nuxt/nuxt.js/issues/4598)) ([add8000](https://github.com/nuxt/nuxt.js/commit/add8000))
* **server:** export Listener ([#4577](https://github.com/nuxt/nuxt.js/issues/4577)) ([2f0ed85](https://github.com/nuxt/nuxt.js/commit/2f0ed85))
* **server:** timing option for `Server-Timing` header ([#4800](https://github.com/nuxt/nuxt.js/issues/4800)) ([b23f5c9](https://github.com/nuxt/nuxt.js/commit/b23f5c9))
* **test:** unit tests for core/config module ([#4760](https://github.com/nuxt/nuxt.js/issues/4760)) ([a616c09](https://github.com/nuxt/nuxt.js/commit/a616c09))
* **ts:** add TSX support ([#4613](https://github.com/nuxt/nuxt.js/issues/4613)) ([4d52742](https://github.com/nuxt/nuxt.js/commit/4d52742))
* **ts:** auto generate tsconfig.json ([#4776](https://github.com/nuxt/nuxt.js/issues/4776)) ([2a1ee96](https://github.com/nuxt/nuxt.js/commit/2a1ee96))
* **ts:** provide type checking through `fork-ts-checker-webpack-plugin` ([#4611](https://github.com/nuxt/nuxt.js/issues/4611)) ([f1377a7](https://github.com/nuxt/nuxt.js/commit/f1377a7))
* **ts:** provide type definitions ([#4164](https://github.com/nuxt/nuxt.js/issues/4164)) ([d5716eb](https://github.com/nuxt/nuxt.js/commit/d5716eb))
* **ts:** typescript examples + improve `vue-app` typings ([#4695](https://github.com/nuxt/nuxt.js/issues/4695)) ([b38e0aa](https://github.com/nuxt/nuxt.js/commit/b38e0aa))
* **vue-app:** <n-link> and <n-child> component aliases ([#4525](https://github.com/nuxt/nuxt.js/issues/4525)) ([1505197](https://github.com/nuxt/nuxt.js/commit/1505197))
* **vue-app:** Add deprecating for classic mode and handle mutations/actions HMR to store/index.js ([c8b920a](https://github.com/nuxt/nuxt.js/commit/c8b920a))
* **vue-app:** add vetur helpers for components auto-complete on VS Code ([#4524](https://github.com/nuxt/nuxt.js/issues/4524)) ([59aee74](https://github.com/nuxt/nuxt.js/commit/59aee74))
* **vue-app:** support named views ([#4410](https://github.com/nuxt/nuxt.js/issues/4410)) ([b1b9e0b](https://github.com/nuxt/nuxt.js/commit/b1b9e0b))
* **vue-app, vue-renderer:** support meta `headAttrs` ([#4536](https://github.com/nuxt/nuxt.js/issues/4536)) ([9961453](https://github.com/nuxt/nuxt.js/commit/9961453))
* **webpack:** add experimental HardSourceWebpackPlugin support ([#4527](https://github.com/nuxt/nuxt.js/issues/4527)) ([c6d820a](https://github.com/nuxt/nuxt.js/commit/c6d820a))
* use runInNewContext: true for nuxt dev ([#4508](https://github.com/nuxt/nuxt.js/issues/4508)) ([1162f2d](https://github.com/nuxt/nuxt.js/commit/1162f2d))
* **webpack:** options.build.loaders.vueStyle ([#4837](https://github.com/nuxt/nuxt.js/issues/4837)) ([762305b](https://github.com/nuxt/nuxt.js/commit/762305b))
* add an option to disable FriendlyErrorsWebpackPlugin ([#4498](https://github.com/nuxt/nuxt.js/issues/4498)) ([f1b2ca3](https://github.com/nuxt/nuxt.js/commit/f1b2ca3))
* add exclude regex array for generated pages ([#4754](https://github.com/nuxt/nuxt.js/issues/4754)) ([ec17804](https://github.com/nuxt/nuxt.js/commit/ec17804))
* add process.modern ([#4532](https://github.com/nuxt/nuxt.js/issues/4532)) ([f1ff634](https://github.com/nuxt/nuxt.js/commit/f1ff634))
* add store module HMR ([#4582](https://github.com/nuxt/nuxt.js/issues/4582)) ([b2eee17](https://github.com/nuxt/nuxt.js/commit/b2eee17))
* add styleExtensions ([#4671](https://github.com/nuxt/nuxt.js/issues/4671)) ([471a32a](https://github.com/nuxt/nuxt.js/commit/471a32a))
* allow `lang="postcss"` in Vue SFCs ([#4417](https://github.com/nuxt/nuxt.js/issues/4417)) ([71136fc](https://github.com/nuxt/nuxt.js/commit/71136fc))
* allow scrollToTop to be explicitly disabled ([#4564](https://github.com/nuxt/nuxt.js/issues/4564)) ([669fecc](https://github.com/nuxt/nuxt.js/commit/669fecc))
* attach ts-loader options on build.loaders.ts ([#4572](https://github.com/nuxt/nuxt.js/issues/4572)) ([d723e49](https://github.com/nuxt/nuxt.js/commit/d723e49))
* better stack traces for SSR error, show error with correct URL and use eventsource-polyfill ([#4600](https://github.com/nuxt/nuxt.js/issues/4600)) ([498c4f1](https://github.com/nuxt/nuxt.js/commit/498c4f1))
* check modern build file in modern mode ([#4467](https://github.com/nuxt/nuxt.js/issues/4467)) ([14fe679](https://github.com/nuxt/nuxt.js/commit/14fe679))
* disable compressor if set to false/undefined ([#4381](https://github.com/nuxt/nuxt.js/issues/4381)) ([e4140ce](https://github.com/nuxt/nuxt.js/commit/e4140ce))
* improve SSR bundle ([#4439](https://github.com/nuxt/nuxt.js/issues/4439)) ([0f104aa](https://github.com/nuxt/nuxt.js/commit/0f104aa)), closes [#4225](https://github.com/nuxt/nuxt.js/issues/4225) [#3465](https://github.com/nuxt/nuxt.js/issues/3465) [#1728](https://github.com/nuxt/nuxt.js/issues/1728) [#1601](https://github.com/nuxt/nuxt.js/issues/1601) [#1481](https://github.com/nuxt/nuxt.js/issues/1481)
* mode for plugins ([#4592](https://github.com/nuxt/nuxt.js/issues/4592)) ([e71c455](https://github.com/nuxt/nuxt.js/commit/e71c455))
* nuxt-ts ([#4658](https://github.com/nuxt/nuxt.js/issues/4658)) ([ee0096b](https://github.com/nuxt/nuxt.js/commit/ee0096b))
* **webpack:** support `build.hotMiddleware.client` ([#4796](https://github.com/nuxt/nuxt.js/issues/4796)) ([dcdbaba](https://github.com/nuxt/nuxt.js/commit/dcdbaba))
* **webpack,cli:** standalone build mode ([#4661](https://github.com/nuxt/nuxt.js/issues/4661)) ([bdb6791](https://github.com/nuxt/nuxt.js/commit/bdb6791))
* preload and push modern resources in modern mode ([#4362](https://github.com/nuxt/nuxt.js/issues/4362)) ([701190d](https://github.com/nuxt/nuxt.js/commit/701190d))
* replace babel-plugin-transform-vue-jsx with [@vue](https://github.com/vue)/babel-preset-jsx ([#4740](https://github.com/nuxt/nuxt.js/issues/4740)) ([da8a3d8](https://github.com/nuxt/nuxt.js/commit/da8a3d8))
* upgrade css loader to v2 ([#4503](https://github.com/nuxt/nuxt.js/issues/4503)) ([af9b30c](https://github.com/nuxt/nuxt.js/commit/af9b30c))


### Performance Improvements

* **pkg:** remove lodash dependency from packages ([#4411](https://github.com/nuxt/nuxt.js/issues/4411)) ([d7851b3](https://github.com/nuxt/nuxt.js/commit/d7851b3))
* **ssr:** remove extra imprts from server.js ([6178c47](https://github.com/nuxt/nuxt.js/commit/6178c47))





## [2.3.4](https://github.com/nuxt/nuxt.js/compare/v2.3.2...v2.3.4) (2018-11-26)


### Bug Fixes

* **pkg:** move opencollective dependency nuxt and nuxt-legacy ([#4415](https://github.com/nuxt/nuxt.js/issues/4415)) ([4a85c03](https://github.com/nuxt/nuxt.js/commit/4a85c03))
* **progress-bar:** allow 0 for values and remove duplicate defaults ([#4397](https://github.com/nuxt/nuxt.js/issues/4397)) ([8030ca1](https://github.com/nuxt/nuxt.js/commit/8030ca1))
* **scrollBehavior:** emit triggerScroll event after changing layer ([#4399](https://github.com/nuxt/nuxt.js/issues/4399)) ([0c6c69b](https://github.com/nuxt/nuxt.js/commit/0c6c69b)), closes [#4080](https://github.com/nuxt/nuxt.js/issues/4080)
* **server, jsdom:** fix timeout error message ([#4412](https://github.com/nuxt/nuxt.js/issues/4412)) ([e1c1240](https://github.com/nuxt/nuxt.js/commit/e1c1240))
* **server, vue-app:** allow unicode page names ([#4402](https://github.com/nuxt/nuxt.js/issues/4402)) ([d187793](https://github.com/nuxt/nuxt.js/commit/d187793))
* empty error message in dev mode ([47f02ae](https://github.com/nuxt/nuxt.js/commit/47f02ae))
* modern=true or false not work as expected ([#4378](https://github.com/nuxt/nuxt.js/issues/4378)) ([ff7c083](https://github.com/nuxt/nuxt.js/commit/ff7c083))
* router Expected "0" to be defined ([#4394](https://github.com/nuxt/nuxt.js/issues/4394)) ([54d2737](https://github.com/nuxt/nuxt.js/commit/54d2737))


### Performance Improvements

* **pkg:** remove lodash dependency from packages ([#4411](https://github.com/nuxt/nuxt.js/issues/4411)) ([7e1beed](https://github.com/nuxt/nuxt.js/commit/7e1beed))
