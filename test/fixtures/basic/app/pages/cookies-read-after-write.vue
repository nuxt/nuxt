<script setup lang="ts">
// set during SSR in `app/plugins/cookie.ts`
const fromPlugin = useCookie('set-in-plugin')

useCookie('written-then-read').value = 'written'
const written = useCookie('written-then-read')

useCookie('default-then-read', { default: () => 'from-default' })
const fromDefault = useCookie('default-then-read')

useCookie('deleted-then-read', { default: () => 'initial' }).value = null
const deleted = useCookie('deleted-then-read')

// a readonly cookie is never written, so it must not be readable back either
useCookie('readonly-then-read', { default: () => 'from-readonly', readonly: true })
const afterReadonly = useCookie('readonly-then-read')

// set on the event directly, outside `useCookie`
if (import.meta.server) {
  useRequestEvent()!.res.headers.append('set-cookie', 'set-via-h3=h3-value; Path=/')
}
const fromH3 = useCookie('set-via-h3')

if (import.meta.server) {
  useRequestEvent()!.res.headers.append('set-cookie', 'set-via-h3-then-deleted=h3-value; Path=/')
}
useCookie('set-via-h3-then-deleted').value = null
const h3ThenDeleted = useCookie('set-via-h3-then-deleted')
</script>

<template>
  <div>
    <div id="from-plugin">
      {{ fromPlugin }}
    </div>
    <div id="written">
      {{ written }}
    </div>
    <div id="from-default">
      {{ fromDefault }}
    </div>
    <div id="deleted">
      {{ deleted ?? 'empty' }}
    </div>
    <div id="after-readonly">
      {{ afterReadonly ?? 'empty' }}
    </div>
    <div id="from-h3">
      {{ fromH3 }}
    </div>
    <div id="h3-then-deleted">
      {{ h3ThenDeleted ?? 'empty' }}
    </div>
  </div>
</template>
