workflow "Nuxt.js Actions" {
  on = "push"
  resolves = ["Npm Audit", "Lint", "Test: E2E", "Coverage: Unit"]
}

action "Install" {
  uses = "nuxt/actions-yarn@master"
  args = "install"
}

action "Lint" {
  uses = "nuxt/actions-yarn@master"
  needs = ["Install"]
  args = "lint"
}

action "Build" {
  uses = "nuxt/actions-yarn@master"
  needs = ["Install"]
  args = "test:fixtures"
}

action "Npm Audit" {
  uses = "actions/npm@e7aaefe"
  needs = ["Install"]
  args = "audit --audit-level=moderate"
}

action "Coverage: Build" {
  uses = "nuxt/actions-yarn@master"
  needs = ["Build"]
  args = "coverage"
}

action "Test: Unit" {
  uses = "nuxt/actions-yarn@master"
  args = "test:unit"
  needs = ["Coverage: Build"]
}

action "Test: E2E" {
  uses = "nuxt/actions-yarn@master"
  args = "test:e2e"
  needs = ["Coverage: Build"]
}

action "Coverage: Unit" {
  uses = "nuxt/actions-yarn@master"
  needs = ["Test: Unit"]
  args = "coverage"
}
