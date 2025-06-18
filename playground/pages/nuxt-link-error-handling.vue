<template>
  <div>
    <h1>NuxtLink Error Handling Demo</h1>
    
    <div class="demo-section">
      <h2>Route Not Found Error</h2>
      <NuxtLink 
        to="/non-existent-page" 
        @error="handleRouteError"
        class="error-link"
      >
        Navigate to Non-existent Page
      </NuxtLink>
      <p v-if="routeError" class="error-message">{{ routeError }}</p>
    </div>

    <div class="demo-section">
      <h2>Middleware Protection Error</h2>
      <NuxtLink 
        to="/admin/protected" 
        @error="handleProtectedError"
        class="error-link"
      >
        Access Protected Admin Area
      </NuxtLink>
      <p v-if="protectedError" class="error-message">{{ protectedError }}</p>
    </div>

    <div class="demo-section">
      <h2>Custom Slot with Error Handling</h2>
      <NuxtLink 
        to="/custom-error-route" 
        @error="handleCustomError"
        custom
      >
        <template #default="{ navigate, href, isExternal }">
          <button 
            @click="navigate" 
            class="custom-button"
            :class="{ external: isExternal }"
          >
            Custom Navigation Button ({{ href }})
          </button>
        </template>
      </NuxtLink>
      <p v-if="customError" class="error-message">{{ customError }}</p>
    </div>

    <div class="demo-section">
      <h2>Successful Navigation</h2>
      <NuxtLink 
        to="/" 
        @error="handleSuccessError"
        class="success-link"
      >
        Navigate to Home (Should Work)
      </NuxtLink>
      <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
    </div>
  </div>
</template>

<script setup>
const routeError = ref('')
const protectedError = ref('')
const customError = ref('')
const successMessage = ref('')

function handleRouteError(error) {
  console.error('Route error:', error)
  routeError.value = `Navigation failed: ${error.message}`
  
  // Clear error after 5 seconds
  setTimeout(() => {
    routeError.value = ''
  }, 5000)
}

function handleProtectedError(error) {
  console.error('Protected route error:', error)
  
  if (error.name === 'NavigationAborted') {
    protectedError.value = 'Access denied: You need to be logged in as an admin.'
  } else {
    protectedError.value = `Access error: ${error.message}`
  }
  
  setTimeout(() => {
    protectedError.value = ''
  }, 5000)
}

function handleCustomError(error) {
  console.error('Custom navigation error:', error)
  customError.value = `Custom navigation failed: ${error.message}`
  
  setTimeout(() => {
    customError.value = ''
  }, 5000)
}

function handleSuccessError(error) {
  // This shouldn't be called for successful navigation
  console.error('Unexpected error on successful route:', error)
}

// Show success message when navigating to home
onMounted(() => {
  const route = useRoute()
  if (route.path === '/') {
    successMessage.value = 'Successfully navigated!'
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  }
})
</script>

<style scoped>
.demo-section {
  margin: 2rem 0;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.error-link, .success-link, .custom-button {
  display: inline-block;
  padding: 0.5rem 1rem;
  margin: 0.5rem 0;
  text-decoration: none;
  border-radius: 4px;
  transition: all 0.2s;
}

.error-link {
  background-color: #fee2e2;
  color: #dc2626;
  border: 1px solid #fca5a5;
}

.error-link:hover {
  background-color: #fecaca;
}

.success-link {
  background-color: #dcfce7;
  color: #16a34a;
  border: 1px solid #86efac;
}

.success-link:hover {
  background-color: #bbf7d0;
}

.custom-button {
  background-color: #dbeafe;
  color: #2563eb;
  border: 1px solid #93c5fd;
  cursor: pointer;
}

.custom-button:hover {
  background-color: #bfdbfe;
}

.custom-button.external {
  background-color: #fef3c7;
  color: #d97706;
  border: 1px solid #fcd34d;
}

.error-message {
  color: #dc2626;
  background-color: #fee2e2;
  padding: 0.5rem;
  border-radius: 4px;
  margin-top: 0.5rem;
}

.success-message {
  color: #16a34a;
  background-color: #dcfce7;
  padding: 0.5rem;
  border-radius: 4px;
  margin-top: 0.5rem;
}
</style>