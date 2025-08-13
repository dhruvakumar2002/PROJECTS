import React, { useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import LiveStream from './pages/LiveStream';
import Login from './pages/Login';
import Playback from './pages/Playback';
import io from 'socket.io-client';

const SIGNALING_SERVER_URL = 'http://10.78.191.141:5001/';
const ROOM_ID = 'test-room';

function App() {
  const localVideo = useRef();
  const remoteVideo = useRef();
  const [isStreamer, setIsStreamer] = useState(false);
  const [connected, setConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);

  const pc = useRef(null);
  const socket = useRef(null);

  const start = async (streamer) => {
    setIsStreamer(streamer);
    socket.current = io(SIGNALING_SERVER_URL);
    pc.current = new window.RTCPeerConnection();

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

    pc.current.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };

    if (streamer) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.current.srcObject = stream;
      stream.getTracks().forEach((track) => pc.current.addTrack(track, stream));
    }

    setConnected(true);
  };

  return (
    <Router>

      <div className="min-h-screen bg-slate-900 text-gray-100">
        <nav className="bg-slate-800 text-gray-100 px-6 py-4 flex flex-col md:flex-row items-center justify-between shadow">
          <div className="font-bold text-2xl mb-2 md:mb-0">AV Streaming</div>
          <div className="flex gap-6">
            <NavLink
              to="/live"
              className={({ isActive }) => `hover:underline transition ${isActive ? 'underline font-semibold text-white' : 'text-gray-300'}`}
            >
              Live Stream
            </NavLink>
            
            <NavLink
              to="/playback"
              className={({ isActive }) => `hover:underline transition ${isActive ? 'underline font-semibold text-white' : 'text-gray-300'}`}
            >
              Playback
            </NavLink>
          </div>
        </nav>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/live" element={<LiveStream remoteStream={remoteStream} />} />
          
          <Route path="/playback" element={<Playback />} />
          <Route path="*" element={<LiveStream remoteStream={remoteStream} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 
