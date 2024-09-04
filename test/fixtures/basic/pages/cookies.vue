<script setup lang="ts">
import CookieComponent from '../components/ComponentUsingCookie.vue'
import { useCookieManager } from '../composables/cookie-manager'

useCookie('accessed-but-not-used')
useCookie('accessed-with-default-value', { default: () => 'default' })
useCookie('set').value = 'set'
useCookie('set-to-null').value = null
useCookie<string | null>('set-to-null-with-default', { default: () => 'default' }).value = null

// the next set are all sent by browser
useCookie('browser-accessed-but-not-used')
useCookie('browser-accessed-with-default-value', { default: () => 'default' })
useCookie('browser-set').value = 'set'
// confirm that it only sets one `set-cookie` header
useCookie('browser-set').value = 'set'
useCookie('browser-set-to-null').value = null
useCookie<string | null>('browser-set-to-null-with-default', { default: () => 'default' }).value = null

const objectCookie = useCookie<{ foo: string } | undefined>('browser-object-default')
const objectCookieSecond = useCookie('browser-object-default', {
  default: () => ({ foo: 'bar' }),
})
function changeCookie () {
  if (objectCookie.value!.foo === 'baz') {
    objectCookie.value!.foo = 'bar'
  } else {
    objectCookie.value!.foo = 'baz'
  }
}

const { showCookieBanner, toggle } = useCookieManager()
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

    <CookieComponent />
    <div
      v-if="showCookieBanner"
      id="parent-banner"
    >
      parent banner
    </div>
    <button @click="toggle">
      Toggle cookie banner
    </button>
  </div>
</template>
