# Contributing to Nuxt.js

First of all, thank you for considering to contribute to Nuxt.js! :heart:

## Getting started

1. [Fork](https://help.github.com/articles/fork-a-repo/) this repository to your own GitHub account and then [clone](https://help.github.com/articles/cloning-a-repository/) it to your local device.
2. Run `npm install` or `yarn install` to install the dependencies.

> _Note that both **npm** and **yarn** have been seen to miss installing dependencies. To remedy that, you can either delete the `node_modules` folder in your example app and install again or do a local install of the missing dependencies._

> If you are adding a dependency, please use `yarn add`. The `yarn.lock` file is the source of truth for all Nuxt dependencies.

## Test structure

A great PR, whether it includes a bug fix or a new feature, will often include tests.
To write great tests, let us explain our test structure:

### Fixtures

The fixtures (found under `tests/fixtures`) contain several Nuxt applications. To keep build time as short as possible,
we don't build an own Nuxt application per test. Instead, the fixtures are built (`yarn test:fixtures`) before running
the actual unit tests.

Please make sure to **alter** or **add a new fixture** when submitting a PR to reflect the changes properly (if applicable).

Also, don't forget to **rebuild** a fixture after changing it by running the corresponding test
with `jest test/fixtures/my-fixture/my-fixture.test.js`!

### Unit tests

The unit tests can be found in `tests/unit` and will be executed after building the fixtures. A fresh Nuxt server will be used
per test so that no shared state (except the initial state from the build step) is present.

After adding your unit tests, you can run them directly:

```sh
jest test/unit/test.js
```

Or you can run the whole unit test suite:

```sh
yarn test:unit
```

Again, please be aware that you might have to rebuild your fixtures before!

## Testing your changes

While working on your PR you will likely want to check if your fixture is set up correctly or debug your current changes.

To do so you can use the Nuxt script itself to launch for example your fixture or an example app:

```sh
bin/nuxt examples/your-app
bin/nuxt test/fixtures/your-fixture-app
```

> `npm link` could also (and does, to some extent) work for this, but it has been known to exhibit some issues. That is why we recommend calling `bin/nuxt` directly to run examples.

## Examples

If you are working on a larger feature, please set up an example app in `examples/`.
This will help greatly in understanding changes and also help Nuxt users to understand the feature you've built in-depth.

## Linting

As you might have noticed already, we are using ESLint to enforce a code standard. Please run `yarn lint` before committing
your changes to verify that the code style is correct. If not, you can use `yarn lint -- --fix` (no typo!) to fix most of the
style changes. If there are still errors left, you must correct them manually.

## Documentation

If you are adding a new feature, do a refactoring or change the behavior of Nuxt in any other manner, you'll likely
want to document the changes. Please do so with a PR to the [docs](https://github.com/nuxt/docs/pulls) repository.
You don't have to write documentation up immediately (but please do so as soon as your pull request is mature enough).

## Final checklist

When submitting your PR, there is a simple template that you have to fill out.
Please tick all appropriate "answers" in the checklists.

## Troubleshooting

### Debugging tests on macOS

Searching for `getPort()` will reveal it's used to start new Nuxt processes during tests. It's been seen to stop working on macOS at times and may require you to manually set a port for testing.

Another common issue is Nuxt processes that may hang in memory when running fixture tests. A ghost process will often prevent subsequent tests from working. Run `ps aux | grep -i node` to inspect any hanging test processes if you suspect this is happening.
