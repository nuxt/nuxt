# `@nuxt/babel-preset-app`

> Default babel preset for nuxt

## Usage

This is the default preset used by Nuxt, which is mainly a wrapper around the `@babel/preset-env` preset. It also optionally uses the `@vue/babel-preset-jsx` preset as well as `@babel/plugin-syntax-dynamic-import`, `@babel/plugin-proposal-decorators`, `@babel/plugin-proposal-class-properties`, `@babel/plugin-transform-runtime`. Furthermore the preset is adding polyfills.

**Note**: Since `core-js@2` and `core-js@3` are both supported from Babel 7.4.0, we recommend directly adding `core-js` and setting the version via the [`corejs`](#corejs) option.

```sh
yarn add --dev core-js@3 @babel/runtime-corejs3

# or

yarn add --dev core-js@2 @babel/runtime-corejs2

```

Usually, no additional configuration is required. If needed though, there is an option to fine-tune the preset's behavior. Just add the following to `nuxt.config.js`:

```js
babel: {
  presets({ isServer }) {
    return [
      [ "@nuxt/babel-preset-app", options ]
    ]
  }
}
```

`options` is an object with parameters, for example:

```js
const options = {
  useBuiltIns: "entry"
}
```

Below is a list of all available parameters:

### Options

* **buildTarget** - passed in through the Builder, either `"server"` or `"client"`
* **configPath** - [`@babel/preset-env` parameter](https://babeljs.io/docs/en/babel-preset-env#configpath)
* **forceAllTransforms** - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#forcealltransforms)' parameter
* **debug**, default  `false` - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#debug)' parameter
* **decoratorsBeforeExport**
* **decoratorsLegacy**, default true
* **exclude** - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#exclude)' parameter
* **ignoreBrowserslistConfig**, defaults to value of `modern` - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#ignorebrowserslistconfig)' parameter
* **include** - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#include)' parameter
* **jsx**, default truish, can be a an object passed as params to [@vue/babel-preset-jsx`](https://www.npmjs.com/package/@vue/babel-preset-jsx)
* **loose**, default `false` - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#loose)' parameter and also sets `loose=true` for `@babel/plugin-proposal-class-properties`
* **modern** passed by builder, either `true` or `false`
* **modules**, default `false` - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#modules)' parameter
* **polyfills**, default `core-js@2: ['es6.array.iterator','es6.promise','es6.object.assign','es7.promise.finally']`, `core-js@3: ['es.array.iterator','es.promise','es.object.assign','es.promise.finally']`, more [in the corresponding repository](https://github.com/zloirock/core-js)
* **shippedProposals** - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#shippedproposals)' parameter
* **spec** - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#spec)' parameter
* **targets** - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#targets)' parameter
* **useBuiltIns**, default `"usage"` - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#usebuiltins)' parameter
* **corejs**, default `{ version: 2 }` - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#corejs)' parameter

There are [detailed docs](https://babeljs.io/docs/en/babel-preset-env#options) for the parameters of '@babel/preset-env'.

### Example 1. Change targets for server and client respectively

```js
export default {
  build: {
    babel: {
      presets({ isServer }) {
        return [
          [
            "@nuxt/babel-preset-app",
            {
              targets: isServer
                ? { node: "current" }
                : { browsers: ["last 2 versions"], ie: 11 }
            }
          ]
        ]
      }
    }
  }
}
```

### Example 2. Use core-js@3

**NOTE**: Make sure that all dependencies have been upgraded to use core-js@3. If core-js@2 and core-js@3 are both dependent, babel may resolve incorrect core-js package which is hoisted by yarn/npm.

```sh
yarn add --dev core-js@2 @babel/runtime-corejs2
```

```js
export default {
  build: {
    babel: {
      presets({ isServer }) {
        return [
          [
            require.resolve('@nuxt/babel-preset-app'),
            {
              buildTarget: isServer ? 'server' : 'client'
              corejs: { version: 3 }
            }
          ]
        ]
      }
    }
  }
}
```
