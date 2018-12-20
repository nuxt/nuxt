workflow "Nuxt.js Actions" {
  on = "push"
  resolves = ["Npm Audit", "Lint", "Test: E2E", "Coverage: Unit"]
}

action "nuxt/actions-yarn@master" {
  uses = "nuxt/actions-yarn@master"
  runs = "install"
}

action "Lint" {
  uses = "nuxt/actions-yarn@master"
  needs = ["nuxt/actions-yarn@master"]
  runs = "lint"
}

action "Build" {
  uses = "nuxt/actions-yarn@master"
  needs = ["nuxt/actions-yarn@master"]
  runs = "test:fixtures"
}

action "Npm Audit" {
  uses = "actions/npm@e7aaefe"
  needs = ["nuxt/actions-yarn@master"]
  runs = "audit"
  args = " --audit-level=moderate"
}

action "Coverage: Build" {
  uses = "nuxt/actions-yarn@master"
  needs = ["Build"]
  runs = "coverage"
}

action "Test: Unit" {
  uses = "nuxt/actions-yarn@master"
  runs = "test:unit"
  needs = ["Coverage: Build"]
}

action "Test: E2E" {
  uses = "nuxt/actions-yarn@master"
  runs = "test:e2e"
  needs = ["Coverage: Build"]
}

action "Coverage: Unit" {
  uses = "nuxt/actions-yarn@master"
  needs = ["Test: Unit"]
  runs = "coverage"
}
