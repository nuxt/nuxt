<script setup lang="ts">
const user = useCookie<{ name: string }>('user')
const logins = useCookie<number>('logins')

const name = ref('')
const interacted = ref(false)

const login = () => {
  logins.value = (logins.value || 0) + 1
  user.value = { name: name.value }
  interacted.value = true
}

const logout = () => {
  user.value = null
  interacted.value = true
}
</script>

<template>
  <NuxtExampleLayout :show-tips="interacted" class="h-50" example="use-cookie">
    <template v-if="user">
      <h1 class="text-3xl mb-3">
        Welcome, {{ user.name }}! 👋
      </h1>
      <div>
        <NTip n="green6" icon="carbon:idea" class="inline-flex">
          You have logged in <b>{{ logins }} times</b>!
        </NTip>
      </div>
      <div class="mt-3">
        <NButton n="red" icon="carbon:logout" @click="logout">
          Log out
        </NButton>
      </div>
    </template>
    <template v-else>
      <h1 class="text-3xl mb-3">
        Login
      </h1>
      <NTextInput v-model="name" n="lg" class="w-100 m-auto" placeholder="Enter your name..." @keypress.enter="login()" />
      <div class="mt-3">
        <NButton icon="carbon:user" :disabled="!name" @click="login">
          Log in
        </NButton>
      </div>
    </template>

    <template #tips>
      <div>
        This demo showcases using the
        <NLink href="https://v3.nuxtjs.org/docs/usage/cookies" target="_blank">
          useCookie
        </NLink>
        API to persist small amounts of data that can be used both client-side and server-side.
      </div>
    </template>
  </NuxtExampleLayout>
</template>
