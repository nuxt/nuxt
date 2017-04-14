export default async function ({ isServer, apolloProvider }) {
  if (isServer) {
    const ensureReady = apolloProvider.collect()
    console.log('Call ensureReady!', ensureReady())
    await ensureReady()
  }
}
