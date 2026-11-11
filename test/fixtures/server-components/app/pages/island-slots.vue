<script setup lang="ts">
const count = ref(0)
const showSecond = ref(false)
</script>

<template>
  <div>
    <div id="first-slots-island">
      <ServerSlots>
        <div id="island-slot-default">
          <button
            id="island-slot-inc"
            @click="count++"
          >
            page {{ count }}
          </button>
        </div>
        <template #in-client>
          <span id="island-slot-in-client">in client {{ count }}</span>
        </template>
      </ServerSlots>
    </div>
    <button
      id="show-second-slots-island"
      @click="showSecond = true"
    >
      Show second
    </button>
    <div
      v-if="showSecond"
      id="second-slots-island"
    >
      <ServerSlots>
        <span id="second-island-slot">second {{ count }}</span>
      </ServerSlots>
    </div>
  </div>
</template>
