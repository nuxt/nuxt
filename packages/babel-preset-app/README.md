# `@nuxt/babel-preset-app`
> Default babel preset for nuxt

## Usage

This is the default preset used by Nuxt, which is mainly a wrapper around the `@babel/preset-env` preset. It also optionally uses the `@vue/babel-preset-jsx` preset as well as `@babel/plugin-syntax-dynamic-import`, `@babel/plugin-proposal-decorators`, `@babel/plugin-proposal-class-properties`, `@babel/plugin-transform-runtime`. Furthermore the preset is adding polyfills.

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
...where `options` is an object with parameters, for example:
```
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
* **polyfills**, default `['es6.array.iterator','es6.promise','es6.object.assign','es7.promise.finally']`, more [in the corresponding repository](https://github.com/zloirock/core-js)
* **shippedProposals** - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#shippedproposals)' parameter
* **spec** - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#spec)' parameter
* **targets** - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#targets)' parameter
* **useBuiltIns**, default `"usage"` - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#usebuiltins)' parameter

There are [detailed docs](https://babeljs.io/docs/en/babel-preset-env#options) for the parameters of '@babel/preset-env'.

### Example 1. Change targets for server and client respectively
```js
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
},
```
