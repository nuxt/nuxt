---
title: "useId"
description: The useId composable creates a unique id.
---

# `useId`

```ts
useId<T>(): string
```

```vue
<script setup lang="ts">
const id = useId()
</script>

<template>
  <div>
    <label :for="id">Login</label>
    <input :id="id" type="text"/>
  </div>
</template>
```
