export default defineNuxtConfig({
  extends: ['./layer'],
  watch: ['one.ts', /^two/]
})
