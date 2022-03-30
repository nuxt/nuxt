<script setup lang="ts">
const user = useCookie<{ name: string }>('user')
const logins = useCookie<number>('logins')

const name = ref('')

const login = () => {
  logins.value = (logins.value || 0) + 1
  user.value = { name: name.value }
}

const logout = () => {
  user.value = null
}
</script>

<template>
  <NuxtExampleLayout class="h-50" example="use-cookie">
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
  </NuxtExampleLayout>
</template>
