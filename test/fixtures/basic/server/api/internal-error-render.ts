export default defineEventHandler(async () => {
  const response = await $fetch.raw<string>('/__nuxt_error?statusCode=418&statusMessage=i-should-not-be-rendered&message=i-should-not-be-rendered', {
    responseType: 'text',
    ignoreResponseError: true,
  })

  return { status: response.status, body: response._data || '' }
})
