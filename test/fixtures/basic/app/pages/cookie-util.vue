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

  const prefixed = $cookie.create({ path: '/scoped', encode: v => `x-${v}`, decode: v => v?.slice(2) })
  prefixed.set('util-prefixed', 'hi')
  results.value.prefixedRaw = $cookie.get('util-prefixed', { decode: v => v })
  results.value.prefixedRead = prefixed.get('util-prefixed')
  results.value.prefixedRef = useCookie('util-prefixed', { $cookie: prefixed }).value
  useCookie('util-prefixed-ref', { $cookie: prefixed }).value = 'from-ref'

  results.value.allKeys = Object.keys($cookie.getAll()).filter(key => key.startsWith('util-')).sort()
}
</script>

<template>
  <pre id="results">{{ JSON.stringify(results) }}</pre>
</template>
