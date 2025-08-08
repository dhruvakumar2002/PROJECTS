# 🚀 Quick Setup Guide - Stream & Record App

## ✅ **Ready to Test!**

Your Expo app is now running and ready for testing. Here's how to get started:

## 📱 **Step 1: Install Expo Go**

### **Android:**
- Download "Expo Go" from Google Play Store
- Or scan the QR code that appears in your terminal

### **iOS:**
- Download "Expo Go" from App Store
- Or scan the QR code that appears in your terminal

## 🔗 **Step 2: Connect to App**

1. **Open Expo Go** on your device
2. **Scan the QR code** that appears in your terminal
3. **Wait for the app to load** (may take a few seconds)
4. **Grant permissions** when prompted (camera & microphone)

## 🎯 **Step 3: Test the App**

### **Basic Testing:**
1. **Check Local Video**: You should see your camera feed
2. **Test Buttons**: Try the different streaming options
3. **Check Status**: Verify the streaming status indicator

### **Advanced Testing:**
1. **Multiple Devices**: Use another device to test streaming
2. **Server Connection**: Ensure your server is running at `http://10.28.159.141:5001/`
3. **Network**: Make sure both devices are on the same network

## 🔧 **Troubleshooting**

### **If QR Code Doesn't Work:**
```bash
# In your terminal, press 'a' for Android
# Or press 'i' for iOS simulator
```

### **If App Doesn't Load:**
```bash
# Clear cache and restart
npx expo start --clear
```

### **If No Video:**
- Check camera permissions in device settings
- Restart the Expo Go app
- Try on a different device

## 📋 **What to Test**

- [ ] App launches successfully
- [ ] Camera permission granted
- [ ] Local video appears
- [ ] Buttons are responsive
- [ ] Status indicators work
- [ ] Can start/stop streaming
- [ ] Server connection works

## 🎉 **Success!**

Once you see your camera feed and can interact with the buttons, your streaming app is working perfectly!

---

**Next**: Test with multiple devices to verify the full streaming functionality. 