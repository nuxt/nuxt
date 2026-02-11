<script setup lang="ts">
const { polite, assertive, message } = useAnnouncer()

definePageMeta({
  layout: 'with-announcer',
})

function announcePolite () {
  polite('Polite announcement')
}

function announceAssertive () {
  assertive('Assertive announcement')
}
</script>

<template>
  <div>
    <h1>Announcer Test Page</h1>
    <p data-testid="current-message">
      {{ message }}
    </p>
    <button
      data-testid="polite-button"
      @click="announcePolite"
    >
      Announce Polite
    </button>
    <button
      data-testid="assertive-button"
      @click="announceAssertive"
    >
      Announce Assertive
    </button>
  </div>
</template>
