export default defineEventHandler<{ body: { title: string, count: number }, query: { page: string } }, { created: boolean }>(() => ({ created: true }))
