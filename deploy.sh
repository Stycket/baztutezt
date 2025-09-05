#!/bin/bash

# Bastun Deployment Script
# This script builds and deploys the application using PM2

echo "🚀 Starting Bastun deployment..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Please install it first:"
    echo "npm install -g pm2"
    exit 1
fi

# Build the application
echo "📦 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Create logs directory if it doesn't exist
mkdir -p logs

# Start/Restart the application with PM2
echo "🔄 Starting application with PM2..."
pm2 start ecosystem.config.js --env production

if [ $? -eq 0 ]; then
    echo "✅ Application started successfully!"
    echo ""
    echo "📊 PM2 Status:"
    pm2 status
    echo ""
    echo "📝 Useful commands:"
    echo "  pm2 logs svelte          # View logs"
    echo "  pm2 restart svelte       # Restart app"
    echo "  pm2 stop svelte          # Stop app"
    echo "  pm2 monit               # Monitor apps"
else
    echo "❌ Failed to start application!"
    exit 1
fi
