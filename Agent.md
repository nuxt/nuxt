# Nuxt AI Agent Guide

This document provides comprehensive information for AI agents working on the Nuxt codebase.

## Project Overview

Nuxt is a next-generation testing framework powered by Vite. This is a monorepo using pnpm workspaces with the following key characteristics:

- **Language**: TypeScript/JavaScript
- **Package Manager**: pnpm (required)
- **Node Version**: ^20.0.0 || ^22.0.0 || >=24.0.0
- **Build System**: Vite
- **Monorepo Structure**: 10 packages in `packages/` directory

## Setup and Development

### Initial Setup
1. Run `pnpm install` to install dependencies
2. Run `pnpm build` to build all packages
3. Run `pnpm lint` to check lint