<script setup lang="ts">

const islandProps = ref({
  bool: true,
  number: 100,
  str: 'hello world',
  obj: { json: 'works' },
})

const showIslandSlot = ref(false)
const routeIslandVisible = ref(false)
const testCount = ref(0)
const count = ref(0)
</script>

<template>
  <div>
    Pure island component:
  
    
    <AsyncServerComponent :count="count">
      <div id="slot-in-server">
        Slot with in .server component
      </div>
    </AsyncServerComponent>
    
  </div>
</template>

<style scoped>
.box {
  border: 1px solid black;
  margin: 3px;
  display: flex;
}
</style>
