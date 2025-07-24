#!/bin/bash

# Script to expose the streaming server externally using ngrok
# Make sure your server is running on port 5001 before running this script

echo "🚀 Starting ngrok tunnel for streaming server..."
echo "Make sure your server is running on port 5001 first!"
echo ""

# Check if server is running
if ! lsof -i :5001 > /dev/null 2>&1; then
    echo "❌ No server detected on port 5001"
    echo "Please start your server first with: npm run server"
    exit 1
fi

echo "✅ Server detected on port 5001"
echo "Starting ngrok tunnel..."
echo ""

# Start ngrok tunnel
ngrok http 5001 --log stdout

# Alternative methods (commented out):
# For specific domain (requires ngrok account):
# ngrok http 5001 --domain=your-custom-domain.ngrok.io

# For TCP tunnel (if needed):
# ngrok tcp 5001
