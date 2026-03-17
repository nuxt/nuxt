type AssetURLFn = (path: string) => string

export function setAssetURLGlobals (buildAssetsURL: AssetURLFn, publicAssetsURL: AssetURLFn) {
  // @ts-expect-error private property consumed by vite-generated url helpers
  globalThis.__buildAssetsURL = buildAssetsURL
  // @ts-expect-error private property consumed by vite-generated url helpers
  globalThis.__publicAssetsURL = publicAssetsURL
}
