import type { H3Event, EventHandlerRequest } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ reset?: boolean }>(event)
  if (body?.reset) {
    const count = await h3Counter(event, 'my-h3-counter', true)
    return { count }
  }
  const count = await h3Counter(event, 'my-h3-counter')
  return { count }
})

async function h3Counter(event: H3Event<EventHandlerRequest>, name: string, reset = false) {
  const session = await useSession<{ counter?: number }>(event, {
    name,
    password: 'supersecretpasswordsupersecretpasswordsupersecretpasswordsupersecretpasswordsupersecretpassword',
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    },
  })
  if (reset) {
    await session.update({ counter: 0 })
    return 0
  }
  const currentCount = session.data.counter || 0
  await session.update({ counter: currentCount + 1 })
  return currentCount + 1
}
