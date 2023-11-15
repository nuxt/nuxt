<script setup lang="ts">
const islandProps = ref({
  bool: true,
  number: 100,
  str: 'helo world',
  obj: { json: 'works' }
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
      <NuxtIsland
        name="PureComponent"
        :props="islandProps"
      />
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

    <p>async .server component</p>
    <AsyncServerComponent :count="count">
      <div id="slot-in-server">
        Slot with in .server component
      </div>
    </AsyncServerComponent>
    <div>
      Async component (1000ms):
      <div>
        <NuxtIsland
          name="LongAsyncComponent"
          :props="{ count }"
        >
          <div>Interactive testing slot</div>
          <div id="first-sugar-counter">
            <SugarCounter :multiplier="testCount" />
          </div>
          <template #test="scoped">
            <div id="test-slot">
              Slot with name test - scoped data {{ scoped }}
            </div>
          </template>
          <template #hello="scoped">
            <div id="test-slot">
              Slot with name hello - scoped data {{ scoped }}
            </div>
          </template>
        </NuxtIsland>
        <button
          id="update-server-components"
          @click="count++"
        >
          add +1 to count
        </button>
      </div>
    </div>
    <div>
      <p>Island with props mounted client side</p>
      <button
        id="show-island"
        @click="showIslandSlot = true"
      >
        Show Interactive island
      </button>
      <div id="island-mounted-client-side">
        <NuxtIsland
          v-if="showIslandSlot"
          name="LongAsyncComponent"
          :props="{ count }"
        >
          <div>Interactive testing slot post SSR</div>
          <SugarCounter :multiplier="testCount" />
        </NuxtIsland>
      </div>
    </div>
  </div>
</template>

<style scoped>
.box {
  border: 1px solid black;
  margin: 3px;
  display: flex;
}
</style>
