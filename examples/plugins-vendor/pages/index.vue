<template>
  <div>
    <p>Home - <router-link to="/about">About</router-link></p>
    <p>
      <input v-validate data-rules="required|email" type="text" name="email">
      <span v-show="errors.has('email')" class="help is-danger">{{ errors.first('email') }}</span>
    </p>
  </div>
</template>

<script>
export default {}
</script>
