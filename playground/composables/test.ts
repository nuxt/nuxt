interface ResT {
  foo: string[]
  bar: string[]
}

const { data } = await useFetchCustom<ResT>('/some/endpoint', {
  default: () => ({
    foo: [],
    bar: [],
  }),
})
if (data.value) {
  const a = data.value
}
