# Contributing to Nuxt.js

1. [Fork](https://help.github.com/articles/fork-a-repo/) this repository to your own GitHub account and then [clone](https://help.github.com/articles/cloning-a-repository/) it to your local device.
2. Run `npm install` to install the dependencies.

> _Note that both **npm** and **yarn** have been seen to miss installing dependencies. To remedy that, you can either delete the `node_modules` folder in your example app and install again or do a local install of the missing dependencies._

3. Add an example app to `examples/` before writing any code.
4. Create a fixture app under `test/fixtures/`. See others for examples.

To run an example or fixture app with your copy of Nuxt, do:

```sh
bin/nuxt examples/your-app
bin/nuxt test/fixtures/your-fixture-app
```

> `npm link` could also (and does, to some extent) work for this, but it has been known to exhibit some issues. That is why we recommend calling `bin/nuxt` directly to run examples.

Once you've modified Nuxt and seen your modifications reflected correctly in your example app and fixture, add `unit` and, if necessary, `e2e` tests that can ensure its functionality and future maintanability. Study other tests carefully for reference. 

## Running specific tests

```sh
npm install jest -g
jest test/unit/test.js
```

## Running test suites

```sh
yarn test
```

Or, per group:

```sh
yarn test:fixtures
yarn test:unit
yarn test:e2e
```

## Opening PRs

- Please make sure your PR passes the lint test (`npm run lint`).
- Please wait for tests to run and verify potential failures.
