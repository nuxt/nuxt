#!/bin/bash

set -e

# Restore all git changes
git restore -s@ -SW  -- packages examples docs

# Build all once to ensure things are nice
pnpm build

# use absolute urls for better rendering on npm
sed -i.bak 's/\.\/\.github\/assets/https:\/\/github.com\/nuxt\/nuxt\/tree\/main\/\.github\/assets/g' README.md

REPO_ROOT=$(pwd)

# Release packages
for PKG in packages/* docs ; do
  if [[ $PKG == "packages/nuxi" ]] ; then
    continue
  fi
  if [[ $PKG == "packages/test-utils" ]] ; then
    continue
  fi
  if [[ $PKG == "packages/ui-templates" ]] ; then
    continue
  fi
  pushd $PKG
  TAG="latest"
  if [ "$PKG" == "packages/nuxt" ]; then
    TAG="rc"
  fi
  echo "⚡ Publishing $PKG with tag $TAG"
  cp $REPO_ROOT/LICENSE .
  if [[ $PKG != "docs" ]]; then
    cp $REPO_ROOT/README.md .
  fi
  pnpm publish --access public --no-git-checks --tag $TAG
  popd > /dev/null
done

mv README.md.bak README.md
