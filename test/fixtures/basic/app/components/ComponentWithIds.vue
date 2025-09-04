<script setup>
const emailId = useId()
const passwordId = useId()
</script>

<template>
  <div>
    <label :for="emailId">Email</label>
    <input
      :id="emailId"
      name="email"
      type="email"
    >
    <label :for="passwordId">Password</label>
    <input
      :id="passwordId"
      name="password"
      type="password"
    >
  </div>
</template>
