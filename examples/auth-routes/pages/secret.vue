<template>
  <div>
    <h1>Super secret page</h1>
    <p>If you try to access this URL not connected, you will be redirected to the home page (server-side or client-side)</p>
    <router-link to="/">Back to the home page</router-link>
  </div>
</template>

<script>
export default {
  // we use fetch() because we do not need to set data to this component
  fetch ({ store, redirect }) {
    if (!store.state.authUser) {
      return redirect('/')
    }
  }
}
</script>
