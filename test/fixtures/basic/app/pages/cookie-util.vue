<script setup lang="ts">
const results = useState<Record<string, unknown>>('cookie-util-results', () => ({}))

if (import.meta.server) {
  useCookie('util-set-after-ref')

  results.value = {
    incoming: $cookie.get('util-incoming'),
    incomingJson: $cookie.get('util-incoming-json'),
    hasIncoming: $cookie.has('util-incoming'),
    hasMissing: $cookie.has('util-missing'),
    missingDefault: $cookie.get('util-missing', { default: () => 'fallback' }),
  }

  $cookie.set('util-set', { n: 1 }, { maxAge: 60 })
  results.value.readAfterSet = $cookie.get('util-set')
  results.value.useCookieAfterSet = useCookie('util-set').value

  $cookie.set('util-set-twice', 'first')
  $cookie.set('util-set-twice', 'second')

  $cookie.set('util-set-after-ref', 'from-util')

  $cookie.remove('util-incoming')
  results.value.hasAfterRemove = $cookie.has('util-incoming')
  results.value.useCookieAfterRemove = useCookie('util-incoming').value ?? 'empty'

  $cookie.remove('util-missing')

  const prefixed = $cookie.create({
    path: '/scoped',
    onWrite: (ctx) => { ctx.name = `prefixed-${ctx.name}` },
    onRead: (ctx) => { ctx.value = `${ctx.value}!` },
  })
  prefixed.set('value', 'hi')
  results.value.prefixedRaw = $cookie.get('prefixed-value')
  results.value.prefixedRead = prefixed.get('prefixed-value')

  const signed = $cookie.create({
    onWrite: (ctx) => { if (ctx.raw !== undefined) { ctx.raw = `${ctx.raw}.sig` } },
    onRead: (ctx) => { ctx.raw = ctx.raw?.endsWith('.sig') ? ctx.raw.slice(0, -4) : undefined },
  })
  signed.set('util-signed', { a: 1 })
  results.value.signedRead = signed.get('util-signed')

  results.value.allKeys = Object.keys($cookie.getAll()).filter(key => /^(?:util-|prefixed-)/.test(key)).sort()
}
</script>

<template>
  <pre id="results">{{ JSON.stringify(results) }}</pre>
</template>
