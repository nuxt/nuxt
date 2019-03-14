# Nuxt with TypeScript & ESLint example

Use `yarn lint` or `npm run lint` to lint your TypeScript project !

## Why ESLint and not TSLint ?

See https://eslint.org/blog/2019/01/future-typescript-eslint

## 

## VSCode settings

If you're using VSCode, we recommend using these settings :

```json
"eslint.autoFixOnSave": true,
"eslint.validate": [
  {
    "language": "javascript",
    "autoFix": true
  },
  {
    "language": "typescript",
    "autoFix": true
  },
  {
    "language": "vue",
    "autoFix": true
  }
]
```

It will lint your `.js`, `.ts` & `.vue` files whenever you're saving them.
