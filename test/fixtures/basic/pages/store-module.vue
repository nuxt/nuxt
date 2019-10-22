<template>
  <h1>{{ $store.state.simpleModule.mutateMe }}</h1>
</template>

<script>
export default {
  fetch ({ store }) {
    store.dispatch('simpleModule/mutate')
  }
}
</script>
