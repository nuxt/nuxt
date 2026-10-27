<script setup lang="ts">
const { messages, status, error, send, newSession } = useEveAgent()

const message = ref('')
const isInputDisabled = computed(() => status.value === 'busy' || status.value === 'resuming')

async function handleSubmit () {
  const text = message.value.trim()
  if (!text || isInputDisabled.value) {
    return
  }
  message.value = ''
  await send(text)
}
</script>

<template>
  <main>
    <h1>Nuxt + eve</h1>

    <article
      v-for="item in messages"
      :key="item.id"
      :class="item.role"
    >
      <strong>{{ item.role === 'user' ? 'You' : 'Agent' }}</strong>
      <template
        v-for="(part, index) in item.parts"
        :key="('id' in part && part.id) || index"
      >
        <p v-if="part.type === 'text'">
          {{ part.text }}
        </p>
        <p
          v-else-if="part.type === 'tool'"
          class="tool"
        >
          {{ part.label }} ({{ part.state }})
        </p>
      </template>
    </article>

    <p
      v-if="error"
      class="error"
    >
      {{ error.message }}
    </p>

    <form @submit.prevent="handleSubmit">
      <input
        v-model="message"
        placeholder="Ask about the weather in Paris…"
        :disabled="isInputDisabled"
      >
      <button
        type="submit"
        :disabled="isInputDisabled"
      >
        Send
      </button>
      <button
        type="button"
        @click="newSession"
      >
        New chat
      </button>
    </form>
  </main>
</template>

<style>
main {
  max-width: 40rem;
  margin: 2rem auto;
  font-family: system-ui, sans-serif;
}

article {
  margin-bottom: 1rem;
}

article.user {
  text-align: right;
}

.tool {
  color: #6b7280;
  font-style: italic;
}

.error {
  color: #dc2626;
}

form {
  display: flex;
  gap: 0.5rem;
}

input {
  flex: 1;
}
</style>
