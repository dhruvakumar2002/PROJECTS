# Real-Time Streaming (Mobile)

This is a React Native starter for real-time audio/video streaming using WebRTC and Socket.io.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Install pods (iOS only):
   ```
   npx pod-install ios
   ```

3. Update `SIGNALING_SERVER_URL` in `App.js` to your server's IP address (not localhost).

4. Run the app:
   - Android: `npx react-native run-android`
   - iOS: `npx react-native run-ios`

## Permissions

- **iOS:** Add camera/mic permissions to `Info.plist`:
  ```xml
  <key>NSCameraUsageDescription</key>
  <string>Camera access is required for video streaming.</string>
  <key>NSMicrophoneUsageDescription</key>
  <string>Microphone access is required for audio streaming.</string>
  ```
- **Android:** Add permissions to `AndroidManifest.xml`:
  ```xml
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-permission android:name="android.permission.RECORD_AUDIO" />
  ```

## Usage

- Use one device as streamer ("Start Streaming"), another as viewer ("View Stream").
- You can mix web and mobile clients.

## Notes
- This is a minimal starter. For production, add error handling, better UI, and support for multiple rooms/streams. 