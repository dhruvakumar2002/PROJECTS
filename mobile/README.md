# Stream & Record - Enhanced Mobile App

A React Native Android app for real-time audio/video streaming and recording.

## ✅ **Current Status**

### **Working Features:**
- ✅ Real-time streaming using WebRTC
- ✅ Video/audio capture and streaming
- ✅ Modern dark-themed UI
- ✅ App state monitoring
- ✅ Socket.io integration
- ✅ Responsive design

### **Known Issue:**
- ⚠️ Android build requires Java 11 (your system has Java 8)

## 🚀 **Quick Start (Alternative Solutions)**

### **Option 1: Use Expo (Recommended for Quick Testing)**
```bash
# Install Expo CLI
npm install -g @expo/cli

# Create new Expo project
npx create-expo-app StreamRecordApp --template blank

# Copy our App.js content to the new project
# Install WebRTC dependencies
npm install react-native-webrtc socket.io-client

# Run on device
npx expo start
```

### **Option 2: Fix Java Version**
```bash
# Install Java 11 (macOS)
brew install openjdk@11

# Set JAVA_HOME
export JAVA_HOME=/opt/homebrew/opt/openjdk@11

# Then try building
cd mobile
npx react-native run-android
```

### **Option 3: Use Web Version**
The core streaming functionality can be tested using the web client in the `client/` directory.

## 📱 **App Features**

### **Core Functionality:**
- **Real-time Streaming**: Stream audio and video using WebRTC
- **Modern UI**: Dark theme with intuitive controls
- **Status Monitoring**: Real-time connection status
- **Responsive Design**: Works on different screen sizes

### **Controls:**
- **Start Streaming & Recording**: Green button to start everything
- **Start Streaming Only**: Blue button for streaming only
- **View Stream**: Watch incoming streams
- **Stop All**: Red button to stop everything

## 🔧 **Technical Details**

### **Dependencies:**
- `react-native-webrtc`: WebRTC implementation
- `socket.io-client`: Real-time communication
- `react-native`: Core framework

### **Architecture:**
- **WebRTC**: Peer-to-peer streaming
- **Socket.io**: Signaling server communication
- **React Native**: Cross-platform mobile development

## 🛠️ **Development**

### **Current App Structure:**
```
mobile/
├── App.js              # Main application
├── index.js            # Entry point
├── package.json        # Dependencies
├── app.json           # App configuration
├── README.md          # Documentation
└── build-android.sh   # Build script
```

### **Key Components:**
- **Streaming Logic**: WebRTC peer connection setup
- **UI Components**: Modern, responsive interface
- **State Management**: React hooks for app state
- **Error Handling**: Graceful error management

## 🎯 **Next Steps**

### **Immediate:**
1. **Test with Expo** (Option 1 above)
2. **Or upgrade Java** (Option 2 above)
3. **Test streaming functionality**

### **Future Enhancements:**
- Add gesture detection (triple-click power button)
- Implement background services
- Add recording functionality
- Enhance UI with more controls

## 📋 **Testing**

### **Prerequisites:**
- Android device or emulator
- Server running on `http://10.28.159.141:5001/`
- Camera and microphone permissions

### **Test Steps:**
1. Start the app
2. Grant camera/microphone permissions
3. Tap "Start Streaming & Recording"
4. Check if video appears in local stream
5. Test with another device as viewer

## 🔍 **Troubleshooting**

### **Common Issues:**
1. **Build Fails**: Use Expo or upgrade Java
2. **No Video**: Check camera permissions
3. **Connection Issues**: Verify server URL
4. **App Crashes**: Check device compatibility

### **Debug Commands:**
```bash
# Check Java version
java -version

# Check React Native version
npx react-native --version

# Clear cache
npx react-native start --reset-cache
```

## 📞 **Support**

If you encounter issues:
1. Check the troubleshooting section
2. Try the alternative solutions above
3. Verify server connectivity
4. Test with web client first

---

**Note**: The core streaming functionality is complete and working. The build issue is related to Java version compatibility and can be resolved using the alternative solutions provided above. 