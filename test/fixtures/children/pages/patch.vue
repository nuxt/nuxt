<template>
  <div>
    <h1>
      patch: <i data-date-patch>
        {{ date }}
      </i>
    </h1>
    <NuxtChild />
  </div>
</template>

<script>
export default {
  layout: 'patch',
  asyncData () {
    return {
      date: Date.now()
    }
  }
}
</script>
