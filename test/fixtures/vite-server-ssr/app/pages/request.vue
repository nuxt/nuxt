<script setup lang="ts">
const url = useRequestURL()
const forwarded = useRequestURL({ xForwardedHost: true, xForwardedProto: true })
setResponseStatus(useRequestEvent()!, 203, 'Read the request')
useResponseHeader('x-echo').value = useRequestHeader('x-echo') ?? undefined
const echoed = useResponseHeader('x-echo').value
</script>

<template>
  <p id="request">
    {{ url.protocol }} {{ url.pathname }} {{ forwarded.protocol }} {{ forwarded.host }} {{ echoed }}
  </p>
</template>
