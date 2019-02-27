# `@nuxt/babel-preset-app`
## Default babel preset for nuxt

## Usage

This is the default preset used by Nuxt, which is mainly a wrapper around  '@babel/preset-env' preset. It also optionally uses preset `@vue/babel-preset-jsx`, plugins `@babel/plugin-syntax-dynamic-import`, `@babel/plugin-proposal-decorators`, `@babel/plugin-proposal-class-properties`, `@babel/plugin-transform-runtime`  and adds polyfills.

No additional configuration usually required. But there is an option to fine tune it's behavior if needed. Just add the following to nuxt-config
```js
    babel: {
      presets({ isServer }) {
        return [
          [
            "@nuxt/babel-preset-app", options            
          ]
        ]
      }
    }
```    
where `options` is an object with paramaters of following type
```
 const options = {
      useBuiltIns: "entry"
      }
```
Below is the list of all available parameters

### Options
* **buildTarget** passed by builder, either `"server"` or `"client"`
* **configPath** - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#configpath)' parameter
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
* **polyfills**, default `['es6.array.iterator','es6.promise','es7.promise.finally']`, more [here](https://github.com/zloirock/core-js)
* **shippedProposals** - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#shippedproposals)' parameter
* **spec** - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#spec)' parameter
* **targets** - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#targets)' parameter
* **useBuiltIns**, default `"usage"` - '[@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#usebuiltins)' parameter

[Here](https://babeljs.io/docs/en/babel-preset-env#options) is a detailed docs for '@babel/preset-env' parameters

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
