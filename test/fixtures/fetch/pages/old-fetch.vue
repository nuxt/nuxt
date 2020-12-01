<template>
  <div id="old-fetch">
    oldFetchData: {{ $store.state.oldFetchData }}
  </div>
</template>

<script>
export default {
  data () {
    return {
      team: []
    }
  },
  fetch ({ store, route }) {
    store.commit('setOldFetchData', route.name)
  }
}
</script>
