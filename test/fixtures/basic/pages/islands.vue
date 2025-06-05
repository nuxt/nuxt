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
    <div class="box">
      <NuxtIsland
        name="PureComponent"
        :props="islandProps"
      />
      <div id="wrapped-client-only">
        <ClientOnly>
          <NuxtIsland
            name="PureComponent"
            :props="islandProps"
          />
        </ClientOnly>
      </div>
    </div>
    <button
      id="increase-pure-component"
      @click="islandProps.number++"
    >
      Increase
    </button>
    <hr>
    Route island component:
    <div
      v-if="routeIslandVisible"
      class="box"
    >
      <NuxtIsland
        name="RouteComponent"
        :context="{ url: '/test' }"
      />
    </div>
    <button
      v-else
      id="show-route"
      @click="routeIslandVisible = true"
    >
      Show
    </button>
  </div>
</template>

<style scoped>
.box {
  border: 1px solid black;
  margin: 3px;
  display: flex;
}
</style>
