export function useServerOnlyComposable () {
  if (import.meta.client) {
    throw new Error('this should not be called in the browser')
  }
}

export function useClientOnlyComposable () {
  // need to do some code that fails in node but not in the browser
  if (import.meta.server) {
    throw new Error('this should not be called on the server')
  }
}

export function setTitleToPink () {
  document.querySelector('h1')!.style.color = 'pink'
}
