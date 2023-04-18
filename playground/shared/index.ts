export function useSomething () {
  const router = useRouter()

  // @ts-expect-error: something doesn't exist
  router.push({ name: 'something' })

  router.push({ name: '/' })
}
