#!/bin/bash

# Simple script to build and start the Bastun app with PM2
echo "🚀 Building and starting Bastun app..."

# Build the app
npm run build

# Start with PM2 using your exact command
PORT=3001 POSTGRES_USER=bastu_admin POSTGRES_PASSWORD=bastupassword POSTGRES_DB=bastudb POSTGRES_HOST=localhost POSTGRES_PORT=5433 pm2 start build/index.js --name "svelte"

echo "✅ Done! App started with PM2"
echo "📊 Check status: pm2 status"
echo "📝 View logs: pm2 logs svelte"
