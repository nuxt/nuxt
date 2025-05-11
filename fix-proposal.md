# Fix for TypeScript 'Type instantiation is excessively deep and possibly infinite' error


## Problem

When using 'nitro.rollupConfig.plugins' in Nuxt configuration, TypeScript's type instantiation depth limit is exceeded, causing the error:

``nType instantiation is excessively deep and possibly infinite.
``n
This happens because of recursive type references in the Nitro configuration types.

## Solution

The solution is to add a dedicated 'NitroRollupConfig' interface in 'packages/schema/src/config/nitro.ts' to break the recursive type dependency chain:
