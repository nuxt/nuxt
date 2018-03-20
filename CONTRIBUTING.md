# Contributing to Nuxt.js

1. [Fork](https://help.github.com/articles/fork-a-repo/) this repository to your own GitHub account and then [clone](https://help.github.com/articles/cloning-a-repository/) it to your local device.
2. Install the dependencies: `npm install`.
3. Run `npm link` to link the local repo to NPM.
4. Then npm link this repo inside any nuxt example app with `npm link nuxt`.
5. Run `npm run build` or `npm run dev` inside your example app, if you created it with [nuxt starter template](https://github.com/nuxt-community/starter-template).
6. Then you can run your example app with the local version of Nuxt.js (You may need to re-run the example app as you change server side code in the Nuxt.js repository).

_Note that both npm and yarn has been seen to miss installing dependencies. To remedy that, you can either delete the node_modules folder in your example app and install again or do a local install of the missing dependencies._

Make sure to add tests into `test/` directory and try them with `npm test` before making a pull request.
