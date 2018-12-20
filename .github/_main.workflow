workflow "Nuxt.js Actions" {
  on = "push"
  resolves = ["Audit", "Lint", "Test: Unit", "Test: E2E"]
}

action "branch-filter" {
  uses = "actions/bin/filter@master"
  args = ["branch dev"]
}

action "Install" {
  uses = "nuxt/actions-yarn@master"
  args = "install --frozen-lockfile --non-interactive"
}

action "Audit" {
  uses = "nuxt/actions-yarn@master"
  args = "audit"
}

action "Lint" {
  uses = "nuxt/actions-yarn@master"
  needs = ["Install"]
  args = "lint"
}

action "Build" {
  uses = "nuxt/actions-yarn@master"
  needs = ["Install"]
  runs = "yarn test:fixtures --coverage && yarn coverage"
}

action "Test: Unit" {
  uses = "nuxt/actions-yarn@master"
  needs = ["Build"]
  runs = "yarn test:unit --coverage && yarn coverage"
}

action "Test: E2E" {
  uses = "nuxt/actions-yarn@master"
  args = "test:e2e"
  needs = ["Build"]
}
