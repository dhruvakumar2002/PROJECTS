#!/bin/bash

# Stream & Record Android Build Script
echo "🚀 Building Stream & Record Android App..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the mobile directory."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if Android SDK is available
if [ -z "$ANDROID_HOME" ]; then
    echo "⚠️  Warning: ANDROID_HOME not set. Please set your Android SDK path."
    echo "   Example: export ANDROID_HOME=/path/to/android/sdk"
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
cd android
./gradlew clean
cd ..

# Start Metro bundler in background
echo "📱 Starting Metro bundler..."
npx react-native start --reset-cache &
METRO_PID=$!

# Wait a moment for Metro to start
sleep 5

# Build and run on Android
echo "🔨 Building and running on Android..."
npx react-native run-android

# Clean up Metro process
kill $METRO_PID 2>/dev/null

echo "✅ Build complete!"
echo ""
echo "📋 Next steps:"
echo "1. Make sure your Android device/emulator is connected"
echo "2. Grant all necessary permissions when prompted"
echo "3. Test the triple-click power button gesture"
echo "4. Check that streaming and recording work properly"
echo ""
echo "🔧 Troubleshooting:"
echo "- If build fails, try: cd android && ./gradlew clean && cd .."
echo "- If Metro issues: npx react-native start --reset-cache"
echo "- If permission issues: Check device settings and restart app" 