type Foo<T> = T extends number ? string : boolean

const runtimeConfig = {
  foo: {
    bar: 1 as unknown as Foo<1>,
    bar: true,
  },
}

export default defineNuxtConfig({
  devtools: { enabled: true },
  runtimeConfig,
  compatibilityDate: 'latest',
})
