#!/bin/bash

set -e

# Restore all git changes
git restore -s@ -SW  -- packages examples

# Build all once to ensure things are nice
yarn build

# Release packages
for PKG in packages/* ; do
  pushd $PKG
  TAG="latest"
  if [ "$PKG" == "packages/nuxt" ]; then
    TAG="rc"
  fi
  echo "⚡ Publishing $PKG with tag $TAG"
  npx npm@8.17.0 publish --tag $TAG --access public --tolerate-republish
  popd > /dev/null
done
