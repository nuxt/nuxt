export function useServerOnlyComposable () {
  // @ts-ignore
  if (process.client) {
    throw new Error('this should not be called in the browser')
  }
}

export function useClientOnlyComposable () {
  // need to do some code that fails in node but not in the browser
  // @ts-ignore
  if (process.server) {
    throw new Error('this should not be called on the browser')
  }
}

export function setTitleToPink () {
  document.querySelector('h1')!.style.color = 'pink'
}
