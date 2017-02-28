Tasks for `0.9.10`:
- [x] `build.publicPath` #25
- [x] Use [name].[chunkhash].js for generated js (production) #218
- [x] Add expired headers (production)
- [x] Activate layout only on afterEach #214
- [x] Custom layout in layouts/error.vue #172
- [x] Add Doc for build.filenames, performance.gzip and performance.prefetch
- [ ] Fork preload-webpack-plugin and use it in package.json
- [ ] Test + Coverage performance, cache, filenames
- [ ] Manual tests on router.base & publicPath

-> Not possible to have custom layout for a page, it should do the condition inside the layout itself (because of the middleware strategy)


Release:

## Deprecated
- `process.BROWSER_BUILD` is deprecated in favour of `process.browser` (`BROWSER_BUILD` will be removed for the 1.0)
- `process.SERVER_BUILD` is deprecated in favour of `process.server` (`SERVER_BUILD` will be removed for the 1.0)
