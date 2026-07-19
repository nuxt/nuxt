<script setup lang="ts">
// refresh: true with explicit same-value write — should re-set the cookie
const refreshed = useCookie('refresh-with-write', {
  maxAge: 3600,
  refresh: true,
})
// eslint-disable-next-line no-self-assign
refreshed.value = refreshed.value

// refresh: true without explicit write — should NOT re-set the cookie
useCookie('refresh-without-write', {
  maxAge: 3600,
  refresh: true,
})

// refresh: false (default) with same-value write — should NOT re-set the cookie
const notRefreshed = useCookie('no-refresh-with-write', {
  maxAge: 3600,
  refresh: false,
})
// eslint-disable-next-line no-self-assign
notRefreshed.value = notRefreshed.value
</script>

<template>
  <div>cookies refresh test</div>
</template>
