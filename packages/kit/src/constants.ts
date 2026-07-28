// Keep in sync with `packages/schema/src/constants.ts`
/**
 * Default extensions for files that may contain JSX.
 * @internal
 */
export const DEFAULT_JSX_FILE_EXTENSIONS: string[] = ['.tsx', '.jsx']

/** Default extensions for JavaScript/TypeScript files, in order of resolution priority. */
export const DEFAULT_JS_FILE_EXTENSIONS: string[] = ['.mjs', '.js', '.cjs', '.mts', '.ts', '.cts', ...DEFAULT_JSX_FILE_EXTENSIONS]
