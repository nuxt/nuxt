# Core Requirements

- The end goal is stability, speed and great user experience.

## Code Quality Requirements

- Follow standard TypeScript conventions and best practices
- Use `<script setup lang="ts">` and the composition API when creating Vue components
- Use clear, descriptive variable and function names
- Add comments only to explain complex logic or non-obvious implementations
- Write unit tests for core functionality using `vitest`
- Write end-to-end tests using Playwright and `@nuxt/test-utils`
- Keep functions focused and manageable (generally under 50 lines), and extract complex logic into separate domain-specific files
- Remove code that is not used or needed
- Use error handling patterns consistently
- Create and maintain a `PROGRESS.md` file to track ongoing work and issues
