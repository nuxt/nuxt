export default defineEventHandler<{ body: { target: string } }, { proxied: boolean }>(() => ({ proxied: true }))
