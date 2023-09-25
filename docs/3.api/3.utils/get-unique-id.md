---
title: "getUniqueID"
description: The getUniqueID utility returns a unique identifier.
---

# `getUniqueID`

The `getUniqueID` utility returns a unique identifier.

```ts
getUniqueID<T>(): string
```

```vue
<script setup lang="ts">
const id = getUniqueID()
</script>

<template>
  <div>
    <label :for="id">Login</label>
    <input :id="id" type="text"/>
  </div>
</template>
```
