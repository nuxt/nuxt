export function useBreakClient () {
  // need to do some code that fails in node but not in the browser
  // @ts-ignore
  if (process.client) {
    throw new Error('this should not be called in the browser')
  }
}
