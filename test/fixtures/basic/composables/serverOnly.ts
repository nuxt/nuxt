export function useModuleServerOnlyComposable () {
  // @ts-ignore
  if (process.client) {
    throw new Error('this should not be called in the browser')
  }
}
