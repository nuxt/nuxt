<script>
export default {
  data () {
    return {
      open: false
    }
  }
}
</script>

<template>
  <NButton @click="open = true">
    Open Modal
  </NButton>
  <Teleport to="body">
    <NCard v-if="open" class="modal p4">
      <p>Hello from the modal!</p>
      <NButton @click="open = false">
        Close
      </NButton>
    </NCard>
  </Teleport>
</template>

<style scoped>
.modal {
  position: fixed;
  z-index: 999;
  top: 20%;
  left: 50%;
  width: 300px;
  margin-left: -150px;
}
</style>
