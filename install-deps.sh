#!/bin/bash

echo "Installing all dependencies..."

npm install express axios bullmq dotenv pg redis @sentry/node prom-client
npm install --save-dev typescript ts-node-dev @types/node @types/express

echo "Dependencies installed ✅"
