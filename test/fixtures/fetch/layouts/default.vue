<template>
  <div>
    <ul>
      <li>
        <n-link to="/">
          Fetch
        </n-link>
      </li>
      <li>
        <n-link to="/fetch-client">
          Fetch on client
        </n-link>
      </li>
      <li>
        <n-link to="/fetch-conditional">
          Fetch conditional
        </n-link>
      </li>
      <li>
        <n-link to="/fetch-error">
          Fetch error
        </n-link>
      </li>
      <li>
        <n-link to="/fetch-delay">
          Fetch delay
        </n-link>
      </li>
      <li>
        <n-link to="/fetch-button">
          Fetch button
        </n-link>
      </li>
      <li>
        <n-link to="/fetch-root">
          Fetch in root click handler
        </n-link>
      </li>
      <li>
        <n-link to="/fetch-component">
          Fetch in component
        </n-link>
      </li>
      <li>
        <n-link to="/fetch-deep">
          Fetch with deep update updates
        </n-link>
      </li>
      <li>
        <n-link to="/old-fetch">
          Deprecated fetch
        </n-link>
      </li>
    </ul>
    <nuxt />
  </div>
</template>
