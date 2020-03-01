module.exports = {
  root: true,
  env: {
    browser: true,
    node: true
  },
  parserOptions: {
    parser: "babel-eslint",
    ecmaFeatures: {
      legacyDecorators: true
    }
  },
  extends: [
    "eslint:recommended",
    // https://github.com/vuejs/eslint-plugin-vue#priority-a-essential-error-prevention
    // consider switching to `plugin:vue/strongly-recommended` or `plugin:vue/recommended` for stricter rules.
    "plugin:prettier/recommended",
    "plugin:vue/recommended",
    "prettier",
    "prettier/vue"
  ],
  // required to lint *.vue files
  plugins: ["prettier", "vue", "vuetify"],
  // add your custom rules here
  rules: {
    "vuetify/no-deprecated-classes": "error",
    "vuetify/grid-unknown-attributes": "error",
    "vuetify/no-legacy-grid": "error",
    //"semi": [2, "never"],
    "no-console": process.env.NODE_ENV === "production" ? "error" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
    "vue/no-v-html": "off"
    //"vue/max-attributes-per-line": "off",
    //"prettier/prettier": ["error", { "semi": false }]
    // "vue/html-self-closing": "off"
  }
}
