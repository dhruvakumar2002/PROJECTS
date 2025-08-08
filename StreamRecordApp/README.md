# Stream & Record - Expo App

A React Native app for real-time audio/video streaming and recording, built with Expo for easy deployment and testing.

## ✅ **Features**

- **Real-time Streaming**: Stream audio and video using WebRTC
- **Modern UI**: Dark theme with intuitive controls
- **Video/Audio Capture**: Access camera and microphone
- **Status Monitoring**: Real-time connection status
- **Responsive Design**: Works on different screen sizes
- **Cross-platform**: Works on iOS and Android

## 🚀 **Quick Start**

### **Prerequisites:**
- Node.js (v16 or higher)
- Expo CLI (already installed)
- Expo Go app on your mobile device

### **Installation:**
```bash
# Dependencies are already installed
npm install

# Start the development server
npx expo start
```

### **Running the App:**
1. **Scan QR Code**: Use Expo Go app to scan the QR code
2. **Or Run on Device**: Press 'a' for Android or 'i' for iOS
3. **Grant Permissions**: Allow camera and microphone access
4. **Start Streaming**: Tap the green button to begin

## 📱 **How to Use**

### **Controls:**
- **Start Streaming & Recording**: Green button to start everything
- **Start Streaming Only**: Blue button for streaming only
- **View Stream**: Watch incoming streams from other devices
- **Stop All**: Red button to stop streaming and recording

### **Testing:**
1. **Single Device**: Test local video capture
2. **Multiple Devices**: Use one as streamer, another as viewer
3. **Web Client**: Test with the web client in the main project

## 🔧 **Technical Details**

### **Dependencies:**
- `expo`: Development platform
- `react-native-webrtc`: WebRTC implementation
- `socket.io-client`: Real-time communication
- `react-native`: Core framework

### **Architecture:**
- **WebRTC**: Peer-to-peer streaming
- **Socket.io**: Signaling server communication
- **Expo**: Development and deployment platform

## 🌐 **Server Configuration**

The app connects to your signaling server at:
```
http://10.28.159.141:5001/
```

Make sure your server is running and accessible from your device.

## 📋 **Testing Checklist**

- [ ] App launches without errors
- [ ] Camera permission granted
- [ ] Microphone permission granted
- [ ] Local video appears in preview
- [ ] Can start streaming
- [ ] Can view remote streams
- [ ] Can stop streaming

## 🔍 **Troubleshooting**

### **Common Issues:**

1. **No Video:**
   - Check camera permissions
   - Restart the app
   - Check device camera functionality

2. **Connection Issues:**
   - Verify server URL is correct
   - Check network connectivity
   - Ensure server is running

3. **App Crashes:**
   - Check Expo Go app version
   - Clear app cache
   - Restart development server

### **Debug Commands:**
```bash
# Clear cache and restart
npx expo start --clear

# Check Expo CLI version
expo --version

# View logs
npx expo start --dev-client
```

## 📱 **Platform Support**

- ✅ **Android**: Full support via Expo Go
- ✅ **iOS**: Full support via Expo Go
- ⚠️ **Web**: Limited WebRTC support

## 🎯 **Next Steps**

### **Immediate:**
1. Test streaming functionality
2. Verify server connectivity
3. Test with multiple devices

### **Future Enhancements:**
- Add gesture detection
- Implement background services
- Add recording functionality
- Enhance UI with more controls

## 📞 **Support**

If you encounter issues:
1. Check the troubleshooting section
2. Verify server connectivity
3. Test with web client first
4. Check Expo documentation

---

**Note**: This Expo version provides the same core functionality as the React Native version but with easier setup and deployment. The app is ready to test immediately! 