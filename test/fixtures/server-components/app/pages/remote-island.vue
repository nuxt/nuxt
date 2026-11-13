<script setup lang="ts">
// The fixture serves its own islands as a remote source.
const source = useRequestURL().origin
</script>

<template>
  <div id="remote-island-page">
    <div id="remote-static">
      <NuxtIsland
        name="MultiServerCounter"
        :props="{ blockId: 'remote-static-island', multiplier: 2 }"
        :source="source"
      />
    </div>
    <div id="remote-interactive">
      <NuxtIsland
        name="MultiServerCounter"
        :props="{ blockId: 'remote-interactive-island', multiplier: 3 }"
        :source="source"
        dangerously-load-client-components
      />
    </div>
    <div id="remote-in-local-slot">
      <ServerSlots>
        <NuxtIsland
          name="MultiServerCounter"
          :props="{ blockId: 'remote-in-slot-island', multiplier: 4 }"
          :source="source"
          dangerously-load-client-components
        />
      </ServerSlots>
    </div>
    <div id="remote-failing">
      <NuxtIsland
        name="MultiServerCounter"
        :props="{ blockId: 'remote-failing-island', multiplier: 1 }"
        source="http://127.0.0.1:1"
      >
        <template #fallback="{ error }">
          <p id="remote-failing-fallback">
            Remote island failed: {{ !!error }}
          </p>
        </template>
      </NuxtIsland>
    </div>
  </div>
</template>
