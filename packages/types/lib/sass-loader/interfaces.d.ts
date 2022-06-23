import * as Sass from 'sass'
import * as Webpack from 'webpack'

export interface LoaderOptions {
    /**
     * The special `implementation` option determines which implementation of Sass
     * to use.
     *
     * By default the loader resolve the implementation based on your dependencies.
     * Just add required implementation to `package.json` (`node-sass` or `sass`
     * package) and install dependencies.
     *
     * Example where the `sass-loader` loader uses the `sass` (`dart-sass`)
     * implementation:
     *
     * **package.json**
     *
     * ```json
     * {
     *   "devDependencies": {
     *     "sass-loader": "^7.2.0",
     *     "sass": "^1.22.10"
     *   }
     * }
     * ```
     *
     * Example where the `sass-loader` loader uses the `node-sass` implementation:
     *
     * **package.json**
     *
     * ```json
     * {
     *   "devDependencies": {
     *     "sass-loader": "^7.2.0",
     *     "node-sass": "^4.0.0"
     *   }
     * }
     * ```
     *
     * Beware the situation when `node-sass` and `sass` were installed! By default
     * the `sass-loader` prefers `node-sass`. In order to avoid this situation you
     * can use the `implementation` option.
     *
     * The `implementation` options either accepts `node-sass` or `sass` (`Dart Sass`)
     * as a module.
     *
     * For example, to use Dart Sass, you'd pass:
     *
     * ```js
     * module.exports = {
     *   module: {
     *     rules: [
     *       {
     *         test: /\.s[ac]ss$/i,
     *         use: [
     *           'style-loader',
     *           'css-loader',
     *           {
     *             loader: 'sass-loader',
     *             options: {
     *               // Prefer `dart-sass`
     *               implementation: require('sass'),
     *             },
     *           },
     *         ],
     *       },
     *     ],
     *   },
     * };
     * ```
     *
     * Note that when using `sass` (`Dart Sass`), **synchronous compilation is twice
     * as fast as asynchronous compilation** by default, due to the overhead of
     * asynchronous callbacks. To avoid this overhead, you can use the [fibers](https://www.npmjs.com/package/fibers)
     * package to call asynchronous importers from the synchronous code path.
     *
     * We automatically inject the [`fibers`](https://github.com/laverdet/node-fibers)
     * package (setup `sassOptions.fiber`) if is possible (i.e. you need install the
     * [`fibers`](https://github.com/laverdet/node-fibers) package).
     *
     * **package.json**
     *
     * ```json
     * {
     *   "devDependencies": {
     *     "sass-loader": "^7.2.0",
     *     "sass": "^1.22.10",
     *     "fibers": "^4.0.1"
     *   }
     * }
     * ```
     *
     * You can disable automatically injecting the [`fibers`](https://github.com/laverdet/node-fibers)
     * package by passing a `false` value for the `sassOptions.fiber` option.
     *
     * **webpack.config.js**
     *
     * ```js
     * module.exports = {
     *   module: {
     *     rules: [
     *       {
     *         test: /\.s[ac]ss$/i,
     *         use: [
     *           'style-loader',
     *           'css-loader',
     *           {
     *             loader: 'sass-loader',
     *             options: {
     *               implementation: require('sass'),
     *               sassOptions: {
     *                 fiber: false,
     *               },
     *             },
     *           },
     *         ],
     *       },
     *     ],
     *   },
     * };
     * ```
     *
     * You can also pass the `fiber` value using this code:
     *
     * **webpack.config.js**
     *
     * ```js
     * module.exports = {
     *   module: {
     *     rules: [
     *       {
     *         test: /\.s[ac]ss$/i,
     *         use: [
     *           'style-loader',
     *           'css-loader',
     *           {
     *             loader: 'sass-loader',
     *             options: {
     *               implementation: require('sass'),
     *               sassOptions: {
     *                 fiber: require('fibers'),
     *               },
     *             },
     *           },
     *         ],
     *       },
     *     ],
     *   },
     * };
     * ```
     */
    implementation?: any;

    /**
     * Options for [Node Sass](https://github.com/sass/node-sass) or [Dart Sass](http://sass-lang.com/dart-sass)
     * implementation.
     *
     * > ℹ️ The `indentedSyntax` option has `true` value for the `sass` extension.
     *
     * > ℹ️ Options such as `file` and `outFile` are unavailable.
     *
     * > ℹ️ We recommend not to use the `sourceMapContents`, `sourceMapEmbed`,
     *   `sourceMapRoot` options because `sass-loader` automatically sets these
     *   options.
     *
     * There is a slight difference between the `node-sass` and `sass` (`Dart Sass`)
     * options. Please consult documentation before using them:
     *
     * - [Node Sass documentation](https://github.com/sass/node-sass/#options) for
     *   all available `node-sass` options.
     * - [Dart Sass documentation](https://github.com/sass/dart-sass#javascript-api)
     *   for all available `sass` options.
     *
     * #### `Object`
     *
     * Use and object for the Sass implementation setup.
     *
     * **webpack.config.js**
     *
     * ```js
     * module.exports = {
     *  module: {
     *    rules: [
     *      {
     *        test: /\.s[ac]ss$/i,
     *        use: [
     *          'style-loader',
     *          'css-loader',
     *          {
     *            loader: 'sass-loader',
     *            options: {
     *              sassOptions: {
     *                indentWidth: 4,
     *                includePaths: ['absolute/path/a', 'absolute/path/b'],
     *              },
     *            },
     *          },
     *        ],
     *      },
     *    ],
     *  },
     * };
     * ```
     *
     * #### `Function`
     *
     * Allows to setup the Sass implementation by setting different options based on
     * the loader context.
     *
     * ```js
     * module.exports = {
     *  module: {
     *    rules: [
     *      {
     *        test: /\.s[ac]ss$/i,
     *        use: [
     *          'style-loader',
     *          'css-loader',
     *          {
     *            loader: 'sass-loader',
     *            options: {
     *              sassOptions: (loaderContext) => {
     *                // More information about available properties https://webpack.js.org/api/loaders/
     *                const { resourcePath, rootContext } = loaderContext;
     *                const relativePath = path.relative(rootContext, resourcePath);
     *
     *                if (relativePath === 'styles/foo.scss') {
     *                  return {
     *                    includePaths: ['absolute/path/c', 'absolute/path/d'],
     *                  };
     *                }
     *
     *                return {
     *                  includePaths: ['absolute/path/a', 'absolute/path/b'],
     *                };
     *              },
     *            },
     *          },
     *        ],
     *      },
     *    ],
     *  },
     * };
     * ```
     */
    sassOptions?: LoaderOptions.SassOptions | LoaderOptions.Callback<LoaderOptions.SassOptions> | undefined;

    /**
     * Prepends `Sass`/`SCSS` code before the actual entry file. In this case, the
     * `sass-loader` will not override the `data` option but just append the entry's
     * content.
     *
     * This is especially useful when some of your Sass variables depend on the
     * environment:
     *
     * > ℹ Since you're injecting code, this will break the source mappings in your
     *   entry file. Often there's a simpler solution than this, like multiple Sass
     *   entry files.
     *
     * #### `String`
     *
     * ```js
     * module.exports = {
     *  module: {
     *    rules: [
     *      {
     *        test: /\.s[ac]ss$/i,
     *        use: [
     *          'style-loader',
     *          'css-loader',
     *          {
     *            loader: 'sass-loader',
     *            options: {
     *              prependData: '$env: ' + process.env.NODE_ENV + ';',
     *            },
     *          },
     *        ],
     *      },
     *    ],
     *  },
     * };
     * ```
     *
     * #### `Function`
     *
     * ```js
     * module.exports = {
     *  module: {
     *    rules: [
     *      {
     *        test: /\.s[ac]ss$/i,
     *        use: [
     *          'style-loader',
     *          'css-loader',
     *          {
     *            loader: 'sass-loader',
     *            options: {
     *              prependData: (loaderContext) => {
     *                // More information about available properties https://webpack.js.org/api/loaders/
     *                const { resourcePath, rootContext } = loaderContext;
     *                const relativePath = path.relative(rootContext, resourcePath);
     *
     *                if (relativePath === 'styles/foo.scss') {
     *                  return '$value: 100px;';
     *                }
     *
     *                return '$value: 200px;';
     *              },
     *            },
     *          },
     *        ],
     *      },
     *    ],
     *  },
     * };
     * ```
     *
     * @default
     * undefined
     */
    additionalData?: string | LoaderOptions.Callback<string> | undefined;

    /**
     * Enables/Disables generation of source maps.
     *
     * By default generation of source maps depends on the [`devtool`](https://webpack.js.org/configuration/devtool/)
     * option. All values enable source map generation except `eval` and `false`
     * value.
     *
     * **webpack.config.js**
     *
     * ```js
     * module.exports = {
     *  module: {
     *    rules: [
     *      {
     *        test: /\.s[ac]ss$/i,
     *        use: [
     *          'style-loader',
     *          {
     *            loader: 'css-loader',
     *            options: {
     *              sourceMap: true,
     *            },
     *          },
     *          {
     *            loader: 'sass-loader',
     *            options: {
     *              sourceMap: true,
     *            },
     *          },
     *        ],
     *      },
     *    ],
     *  },
     * };
     * ```
     *
     * > ℹ In some rare cases `node-sass` can output invalid source maps (it is a
     *   `node-sass` bug). In order to avoid this, you can try to update `node-sass`
     *   to latest version or you can try to set within `sassOptions` the
     *   `outputStyle` option to `compressed`.
     *
     * @defaults
     * Depends on the `compiler.devtool` value.
     */
    sourceMap?: boolean | undefined;

    /**
     * Enables/Disables the default Webpack importer.
     *
     * This can improve performance in some cases. Use it with caution because
     * aliases and `@import` at-rules starting with `~` will not work. You can pass
     * own `importer` to solve this (see [`importer docs`](https://github.com/sass/node-sass#importer--v200---experimental)).
     *
     * **webpack.config.js**
     *
     * ```js
     * module.exports = {
     *  module: {
     *    rules: [
     *      {
     *        test: /\.s[ac]ss$/i,
     *        use: [
     *          'style-loader',
     *          'css-loader',
     *          {
     *            loader: 'sass-loader',
     *            options: {
     *              webpackImporter: false,
     *            },
     *          },
     *        ],
     *      },
     *    ],
     *  },
     * };
     * ```
     *
     * @default
     * true
     */
    webpackImporter?: boolean | undefined;
    /**
     * Treats the @warn rule as a webpack warning.
     *
     * Note: It will be true by default in the next major release.
     *
     * **webpack.config.js**
     *
     * ```js
     * module.exports = {
     *  module: {
     *    rules: [
     *      {
     *        test: /\.s[ac]ss$/i,
     *        use: [
     *          'style-loader',
     *          'css-loader',
     *          {
     *            loader: 'sass-loader',
     *            options: {
     *              warnRuleAsWarning: false,
     *            },
     *          },
     *        ],
     *      },
     *    ],
     *  },
     * };
     * ```
     */
    warnRuleAsWarning ?: boolean | undefined;
}

// eslint-disable-next-line no-redeclare
export namespace LoaderOptions {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type Callback<T> = (loaderContext: Webpack.loader.LoaderContext) => T;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type SassOptions = Sass.Options<'sync'>;
}
