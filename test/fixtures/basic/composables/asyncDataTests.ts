export const useSleep = () => useAsyncData('sleep', async () => {
  await new Promise(resolve => setTimeout(resolve, 50))

  return 'Slept!'
})

export const useCounter = () => useFetch('/api/useAsyncData/count')

export const useSharedAsyncData = () => {
  const route = useRoute()

  const { data, execute, pending } = useAsyncData(
    'sharedAsyncData',
    () => Promise.resolve('some data'),
    {
      default: () => 'default data',
      immediate: false,
      watch: [() => route.query]
    }
  )

  return {
    data,
    execute,
    pending
  }
}
