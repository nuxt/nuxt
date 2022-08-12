#!/bin/bash

set -e

# Restore all git changes
git restore -s@ -SW  -- packages examples

# Bump versions
yarn lerna version --preid rc --no-changelog --exact --no-git-tag-version --no-push -m "chore: release rc"

# Stage
git add --all
