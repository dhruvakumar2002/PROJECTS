import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  Dimensions,
  Platform,
  AppState,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function App() {
  const [isStreamer, setIsStreamer] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);

  // App state change handler
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      setAppState(nextAppState);
    };

    AppState.addEventListener('change', handleAppStateChange);

    return () => {
      AppState.removeEventListener('change', handleAppStateChange);
    };
  }, []);

  const startStreamingAndRecording = async () => {
    try {
      setIsStreaming(true);
      setIsRecording(true);
      
      Alert.alert('Started', 'Streaming and recording started! (Demo Mode)');
    } catch (error) {
      console.log('Start error:', error);
      Alert.alert('Error', 'Failed to start streaming and recording');
    }
  };

  const stopStreamingAndRecording = async () => {
    try {
      setIsStreaming(false);
      setIsRecording(false);
      setConnected(false);
      
      Alert.alert('Stopped', 'Streaming and recording stopped!');
    } catch (error) {
      console.log('Stop error:', error);
      Alert.alert('Error', 'Failed to stop streaming and recording');
    }
  };

  const startStreamingOnly = async () => {
    try {
      setIsStreaming(true);
      setConnected(true);
      
      Alert.alert('Started', 'Streaming started! (Demo Mode)');
    } catch (error) {
      console.log('Start streaming error:', error);
      Alert.alert('Error', 'Failed to start streaming');
    }
  };

  const startViewing = async () => {
    try {
      setConnected(true);
      
      Alert.alert('Started', 'Viewing mode started! (Demo Mode)');
    } catch (error) {
      console.log('Start viewing error:', error);
      Alert.alert('Error', 'Failed to start viewing');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Stream & Record</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: isStreaming ? '#4CAF50' : '#f44336' }]} />
          <Text style={styles.statusText}>
            {isStreaming ? 'Streaming' : 'Not Streaming'}
          </Text>
        </View>
      </View>

      {!connected && !isStreaming && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => startStreamingAndRecording()}
          >
            <Text style={styles.buttonText}>Start Streaming & Recording</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={() => startStreamingOnly()}
          >
            <Text style={styles.buttonText}>Start Streaming Only</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={() => startViewing()}
          >
            <Text style={styles.buttonText}>View Stream</Text>
          </TouchableOpacity>
        </View>
      )}

      {connected && (
        <View style={styles.videoContainer}>
          <View style={styles.videoWrapper}>
            <Text style={styles.videoLabel}>Local Stream</Text>
            <View style={styles.videoPlaceholder}>
              <Text style={styles.placeholderText}>Camera Preview</Text>
              <Text style={styles.placeholderSubtext}>(WebRTC not available in Expo Go)</Text>
            </View>
          </View>
          
          <View style={styles.videoWrapper}>
            <Text style={styles.videoLabel}>Remote Stream</Text>
            <View style={styles.videoPlaceholder}>
              <Text style={styles.placeholderText}>Remote Video</Text>
              <Text style={styles.placeholderSubtext}>(WebRTC not available in Expo Go)</Text>
            </View>
          </View>
        </View>
      )}

      {isStreaming && (
        <View style={styles.controlsContainer}>
          <TouchableOpacity 
            style={[styles.controlButton, styles.stopButton]} 
            onPress={stopStreamingAndRecording}
          >
            <Text style={styles.controlButtonText}>Stop All</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          Demo Mode - UI Testing Only
        </Text>
        <Text style={styles.infoSubtext}>
          WebRTC requires native modules not available in Expo Go
        </Text>
        <Text style={styles.appStatus}>
          App Status: {appState}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 20,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
  },
  buttonContainer: {
    padding: 20,
    gap: 15,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  videoContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 10,
    gap: 10,
  },
  videoWrapper: {
    flex: 1,
  },
  videoLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 5,
    textAlign: 'center',
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  placeholderSubtext: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
  },
  controlsContainer: {
    padding: 20,
  },
  controlButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoContainer: {
    padding: 20,
    backgroundColor: '#2a2a2a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  infoText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 5,
    fontWeight: 'bold',
  },
  infoSubtext: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  appStatus: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
});
