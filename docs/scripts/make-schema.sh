#!/bin/sh
set -e

cd ..
yarn="node `pwd`/.yarn/releases/yarn-*.cjs"
$yarn install
cd packages/kit
$yarn prepack --stub
