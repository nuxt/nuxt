const DECLARATION_FILE_RE = /(?:^|[\\/])[^\\/]+\.d\.(?:c|m)?ts$/

export function createNitroImportsExcludePatterns (excludePattern: RegExp[]) {
  return [
    ...excludePattern,
    /[\\/]\.git[\\/]/,
    DECLARATION_FILE_RE,
  ]
}
