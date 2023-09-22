---
title: "useId"
description: The useId composable creates a unique id.
---

# `useId`

```ts
useId<T>(key: string): DeepReadonly<Ref<string>>
```

* **key**: A unique key that ensures that the id is unique.

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
