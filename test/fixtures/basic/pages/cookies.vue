<script setup lang="ts">
useCookie('accessed-but-not-used')
useCookie('accessed-with-default-value', { default: () => 'default' })
useCookie('set').value = 'set'
useCookie('set-to-null').value = null
useCookie<string | null>('set-to-null-with-default', { default: () => 'default' }).value = null

// the next set are all sent by browser
useCookie('browser-accessed-but-not-used')
useCookie('browser-accessed-with-default-value', { default: () => 'default' })
useCookie('browser-set').value = 'set'
useCookie('browser-set-to-null').value = null
useCookie<string | null>('browser-set-to-null-with-default', { default: () => 'default' }).value = null

const objectCookie = useCookie<{ foo: string } | undefined>('browser-object-default')
const objectCookieSecond = useCookie('browser-object-default', {
  default: () => ({ foo: 'bar' }),
})
function changeCookie () {
  console.log(objectCookie.value, objectCookieSecond.value)
  if (objectCookie.value!.foo === 'baz') {
    objectCookie.value!.foo = 'bar'
  } else {
    objectCookie.value!.foo = 'baz'
  }
}
</script>

<template>
  <div>
    <div>cookies testing page</div>
    <pre>{{ objectCookie?.foo }}</pre>
    <pre>{{ objectCookieSecond.foo }}</pre>
    <button @click="changeCookie">
      Change cookie
    </button>
    <button @click="refreshCookie('browser-object-default')">
      Refresh cookie
    </button>
  </div>
</template>
