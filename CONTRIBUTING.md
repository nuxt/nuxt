# Contributing to Nuxt.js

1. [Fork](https://help.github.com/articles/fork-a-repo/) this repository to your own GitHub account and then [clone](https://help.github.com/articles/cloning-a-repository/) it to your local device.
2. Install the dependencies: `npm install`.
3. Run `npm link` to link the local repo to NPM.
4. `nuxt build` to build and `nuxt` to build and watch for code changes are now globally available but only works inside a nuxt project.
5. Then npm link this repo inside any nuxt example app with `npm link nuxt`.
6. Run `nuxt build` or `nuxt` inside your example app.
7. Then you can run your example app with the local version of Nuxt.js (You may need to re-run the example app as you change server side code in the Nuxt.js repository).

_Note that both npm and yarn has been seen to miss installing dependencies. To remedy that, you can either delete the node_modules folder in your example app and install again or do a local install of the missing dependencies._

Make sure to add tests into `test/` directory and try them with `npm test` before making a pull request.
