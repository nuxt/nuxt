export default defineEventHandler(async () => {
  return new Response(await $fetch<string>('/'), {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
    },
  })
})
