#!/bin/bash
export NODE_OPTIONS="--max-old-space-size=4096"
npx tsx watch src/server.ts
