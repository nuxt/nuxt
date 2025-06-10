export const useSleep = () => useAsyncData('sleep', async () => {
  await new Promise(resolve => setTimeout(resolve, 50))

  return 'Slept!'
})

export const useCounter = () => useFetch('/api/useAsyncData/count')
