import React, { useRef, useState } from 'react';
import { SafeAreaView, View, Button, Text } from 'react-native';
import { RTCView, mediaDevices, RTCPeerConnection } from 'react-native-webrtc';
import io from 'socket.io-client';

const SIGNALING_SERVER_URL = 'http://10.28.159.141:5001'; // Replace with your server's IP
const ROOM_ID = 'test-room';

export default function App() {
  const [isStreamer, setIsStreamer] = useState(false);
  const [connected, setConnected] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const pc = useRef();
  const socket = useRef();

  const start = async (streamer) => {
    setIsStreamer(streamer);
    socket.current = io(SIGNALING_SERVER_URL, { transports: ['websocket'] });
    pc.current = new RTCPeerConnection();

    socket.current.emit('join', ROOM_ID);

    socket.current.on('new-peer', async () => {
      if (streamer) {
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        socket.current.emit('signal', { room: ROOM_ID, data: { type: 'offer', sdp: offer.sdp } });
      }
    });

    socket.current.on('signal', async (data) => {
      if (data.type === 'offer' && !streamer) {
        await pc.current.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);
        socket.current.emit('signal', { room: ROOM_ID, data: { type: 'answer', sdp: answer.sdp } });
      } else if (data.type === 'answer' && streamer) {
        await pc.current.setRemoteDescription({ type: 'answer', sdp: data.sdp });
      } else if (data.type === 'candidate') {
        try {
          await pc.current.addIceCandidate(data.candidate);
        } catch (e) {}
      }
    });

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current.emit('signal', { room: ROOM_ID, data: { type: 'candidate', candidate: event.candidate } });
      }
    };

    pc.current.onaddstream = (event) => {
      setRemoteStream(event.stream);
    };

    if (streamer) {
      const stream = await mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      pc.current.addStream(stream);
    }

    setConnected(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>Real-Time Streaming (Mobile)</Text>
      {!connected && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <Button title="Start Streaming" onPress={() => start(true)} />
          <Button title="View Stream" onPress={() => start(false)} />
        </View>
      )}
      <View style={{ flex: 1, flexDirection: 'row', marginTop: 20 }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text>Local (Capture)</Text>
          {localStream && (
            <RTCView
              streamURL={localStream.toURL()}
              style={{ width: '100%', height: 200, backgroundColor: 'black' }}
              objectFit="cover"
            />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text>Remote (View)</Text>
          {remoteStream && (
            <RTCView
              streamURL={remoteStream.toURL()}
              style={{ width: '100%', height: 200, backgroundColor: 'black' }}
              objectFit="cover"
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
} 