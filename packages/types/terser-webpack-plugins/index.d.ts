// Type definitions for terser-webpack-plugin 4.2
// Project: https://github.com/webpack-contrib/terser-webpack-plugin
// Definitions by: Daniel Schopf <https://github.com/Danscho>
//                 Piotr Błażejewicz <https://github.com/peterblazejewicz>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/* eslint-disable */
import { Plugin } from 'webpack';
import { MinifyOptions } from 'terser';

/**
 * This plugin uses terser to minify your JavaScript.
 */
declare namespace TerserPlugin {
    interface MinifyResult {
        map: any;
        code: any;
        extractedComments: any;
    }

    interface FileData {
        readonly filename: string;
        readonly basename: string;
        readonly query: string;
        readonly hash: string;
    }

    interface ExtractCommentOptions {
        condition: string | RegExp | ExtractCommentFn;
        filename?: string | FilenameFn;
        banner?: boolean | string | FormatFn;
    }

    type ExtractCommentFn = (astNode: any, comment: any) => boolean | object;

    type FormatFn = (input: string) => string;

    type FilenameFn = (fileData: FileData) => string;

    interface TerserPluginOptions {
        /**
         * Test to match files against.
         * @default /\.m?js(\?.*)?$/i
         */
        test?: string | RegExp | Array<string | RegExp>;

        /**
         * Files to include.
         * @default undefined
         */
        include?: string | RegExp | Array<string | RegExp>;

        /**
         * Files to exclude.
         * @default undefined
         */
        exclude?: string | RegExp | Array<string | RegExp>;

        /**
         * ⚠ Ignored in webpack 5! Please use {@link webpack.js.org/configuration/other-options/#cache.}
         * Enable/disable file caching.
         * Default path to cache directory: `node_modules/.cache/terser-webpack-plugin`.
         * @default true
         */
        cache?: boolean | string;

        /**
         * ⚠ Ignored in webpack 5! Please use {@link webpack.js.org/configuration/other-options/#cache}.
         * Allows you to override default cache keys.
         */
        cacheKeys?: (defaultCacheKeys: any, file: any) => object;

        /**
         * Enable/disable multi-process parallel running.
         * Use multi-process parallel running to improve the build speed. Default number of concurrent runs: os.cpus().length - 1.
         * @default true
         */
        parallel?: boolean | number;

        /**
         * Use source maps to map error message locations to modules (this slows down the compilation).
         * If you use your own minify function please read the minify section for handling source maps correctly.
         * @default false
         */
        sourceMap?: boolean;

        /**
         * Allows you to override default minify function.
         * By default plugin uses terser package. Useful for using and testing unpublished versions or forks
         * @default undefined
         */
        minify?: (file: any, sourceMap: any, minimizerOptions?: MinifyOptions) => MinifyResult;

        /**
         * Terser minify {@link https://github.com/terser/terser#minify-options|options}.
         */
        terserOptions?: MinifyOptions;

        /**
         * Whether comments shall be extracted to a separate file, (see details).
         * By default extract only comments using /^\**!|@preserve|@license|@cc_on/i regexp condition and remove remaining comments.
         * If the original file is named foo.js, then the comments will be stored to foo.js.LICENSE.txt.
         * The terserOptions.output.comments option specifies whether the comment will be preserved,
         * i.e. it is possible to preserve some comments (e.g. annotations) while extracting others or even preserving comments that have been extracted
         * @default true
         */
        extractComments?: boolean | string | RegExp | ExtractCommentFn | ExtractCommentOptions;
    }
}

declare class TerserPlugin extends Plugin {
    constructor(opts?: TerserPlugin.TerserPluginOptions);
}

export = TerserPlugin;
