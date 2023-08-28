const delay = () => new Promise(resolve => setTimeout(resolve, 10))

export async function nestedAsyncComposable () {
  await delay()
  return await fn1()
}

async function fn1 () {
  await delay()
  return await fn2()
}

async function fn2 () {
  await delay()
  const app = useNuxtApp()
  return {
    hasApp: !!app
  }
}
