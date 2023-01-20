#!/bin/bash

set -e

# Restore all git changes
git restore -s@ -SW  -- packages examples

# Build all once to ensure things are nice
pnpm build

# Release packages
for PKG in packages/* ; do
  pushd $PKG
  TAG="latest"
  if [ "$PKG" == "packages/nuxt" ]; then
    TAG="rc"
  fi
  echo "⚡ Publishing $PKG with tag $TAG"
  cp ../../LICENSE .
  cp ../../README.md .
  pnpm publish --access public --no-git-checks --tag $TAG
  popd > /dev/null
done
