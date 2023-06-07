// Type definitions for sass-loader 8.0
// Project: https://github.com/webpack-contrib/sass-loader
// Definitions by: Jason Kwok <https://github.com/JasonHK>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 3.7

import { LoaderOptions } from './interfaces'

declare function loader(content: string): void;

// eslint-disable-next-line no-redeclare
declare namespace loader {
    type Options = LoaderOptions;
}

export = loader;
