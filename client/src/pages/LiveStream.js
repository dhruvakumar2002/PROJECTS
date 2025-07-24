import React, { useRef, useState, useEffect } from 'react';
import io from 'socket.io-client';

const SIGNALING_SERVER_URL = 'http://10.28.159.141:5001';
const ROOM_ID = 'test-room';

// Quality presets for adaptive streaming
const QUALITY_PRESETS = {
  high: {
    video: { width: 1280, height: 720, frameRate: 30, bitrate: 2500000 },
    audio: { sampleRate: 48000, channelCount: 2, bitrate: 128000 }
  },
  medium: {
    video: { width: 854, height: 480, frameRate: 25, bitrate: 1000000 },
    audio: { sampleRate: 44100, channelCount: 2, bitrate: 96000 }
  },
  low: {
    video: { width: 640, height: 360, frameRate: 20, bitrate: 500000 },
    audio: { sampleRate: 22050, channelCount: 1, bitrate: 64000 }
  },
  audioOnly: {
    video: false,
    audio: { sampleRate: 22050, channelCount: 1, bitrate: 32000 }
  }
};

const LiveStream = () => {
  const [isStreamer, setIsStreamer] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Waiting for connection...');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [debugInfo, setDebugInfo] = useState('');
  const [currentQuality, setCurrentQuality] = useState('medium');
  const [networkQuality, setNetworkQuality] = useState('unknown');
  const [isAudioOnly, setIsAudioOnly] = useState(false);

  const localVideo = useRef();
  const remoteVideo = useRef();
  const pc = useRef(null);
  const socket = useRef(null);
  const pendingCandidates = useRef([]);
  const isProcessingSignal = useRef(false);
  const connectionId = useRef(null);
  const qualityCheckInterval = useRef(null);
  const networkStats = useRef({ rtt: 0, packetLoss: 0, bandwidth: 0 });
  const chunksRef = useRef([]); // Use ref to store chunks for recording

  // Handle remote stream changes
  useEffect(() => {
    if (remoteStream && remoteVideo.current) {
      updateDebugInfo(`Setting remote video srcObject with ${remoteStream.getTracks().length} tracks`);
      remoteVideo.current.srcObject = remoteStream;
      
      // Add event listeners for debugging
      remoteVideo.current.onloadedmetadata = () => {
        updateDebugInfo('Remote video metadata loaded');
      };
      
      remoteVideo.current.oncanplay = () => {
        updateDebugInfo('Remote video can play');
      };
      
      remoteVideo.current.onerror = (e) => {
        updateDebugInfo('Remote video error: ' + e.message);
      };
      
      remoteVideo.current.onstalled = () => {
        updateDebugInfo('Remote video stalled');
      };
      
      remoteVideo.current.onwaiting = () => {
        updateDebugInfo('Remote video waiting for data');
      };
    }
  }, [remoteStream]);

  // Get available cameras
  const getCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoDevices);
      return videoDevices;
    } catch (err) {
      console.error('Error getting cameras:', err);
      return [];
    }
  };

  // Assess network quality and adjust streaming quality
  const assessNetworkQuality = async () => {
    if (!pc.current || pc.current.connectionState !== 'connected') return;

    try {
      const stats = await pc.current.getStats();
      let totalRtt = 0;
      let totalPacketLoss = 0;
      let totalBandwidth = 0;
      let statCount = 0;

      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          totalRtt += report.currentRoundTripTime || 0;
          statCount++;
        }
        if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
          totalPacketLoss += report.packetsLost || 0;
          totalBandwidth += report.bytesReceived || 0;
        }
      });

      if (statCount > 0) {
        const avgRtt = totalRtt / statCount;
        const packetLossRate = totalPacketLoss / (totalPacketLoss + 1000) * 100; // Estimate
        const bandwidthMbps = (totalBandwidth * 8) / 1000000; // Convert to Mbps

        networkStats.current = { rtt: avgRtt, packetLoss: packetLossRate, bandwidth: bandwidthMbps };

        // Determine quality based on network conditions
        let newQuality = currentQuality;
        let newAudioOnly = isAudioOnly;

        if (avgRtt > 500 || packetLossRate > 10 || bandwidthMbps < 0.5) {
          // Poor network - switch to audio only
          newQuality = 'audioOnly';
          newAudioOnly = true;
          setNetworkQuality('poor');
        } else if (avgRtt > 200 || packetLossRate > 5 || bandwidthMbps < 1.5) {
          // Medium network - use low quality
          newQuality = 'low';
          newAudioOnly = false;
          setNetworkQuality('medium');
        } else if (avgRtt > 100 || packetLossRate > 2 || bandwidthMbps < 3) {
          // Good network - use medium quality
          newQuality = 'medium';
          newAudioOnly = false;
          setNetworkQuality('good');
        } else {
          // Excellent network - use high quality
          newQuality = 'high';
          newAudioOnly = false;
          setNetworkQuality('excellent');
        }

        // Apply quality changes if needed
        if (newQuality !== currentQuality || newAudioOnly !== isAudioOnly) {
          await adjustStreamQuality(newQuality, newAudioOnly);
        }

        updateDebugInfo(`Network: RTT=${avgRtt.toFixed(0)}ms, Loss=${packetLossRate.toFixed(1)}%, BW=${bandwidthMbps.toFixed(1)}Mbps`);
      }
    } catch (error) {
      console.error('Error assessing network quality:', error);
    }
  };

  // Adjust stream quality based on network conditions
  const adjustStreamQuality = async (quality, audioOnly = false) => {
    if (!isStreamer || !localStream) return;

    try {
      updateDebugInfo(`Adjusting quality to: ${quality}${audioOnly ? ' (audio only)' : ''}`);
      
      // Stop current tracks
      localStream.getTracks().forEach(track => track.stop());
      
      // Get new stream with adjusted quality
      const constraints = audioOnly ? 
        { audio: QUALITY_PRESETS.audioOnly.audio } :
        { 
          video: QUALITY_PRESETS[quality].video,
          audio: QUALITY_PRESETS[quality].audio
        };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(newStream);
      localVideo.current.srcObject = newStream;
      
      // Update WebRTC tracks
      if (pc.current && pc.current.connectionState === 'connected') {
        const senders = pc.current.getSenders();
        const videoSender = senders.find(sender => sender.track?.kind === 'video');
        const audioSender = senders.find(sender => sender.track?.kind === 'audio');
        
        if (videoSender && !audioOnly) {
          videoSender.replaceTrack(newStream.getVideoTracks()[0]);
        } else if (videoSender && audioOnly) {
          videoSender.replaceTrack(null); // Remove video track
        }
        
        if (audioSender) {
          audioSender.replaceTrack(newStream.getAudioTracks()[0]);
        }
      }

      setCurrentQuality(quality);
      setIsAudioOnly(audioOnly);
      updateDebugInfo(`Quality adjusted successfully to ${quality}`);
      
      // Update recording if active
      if (isRecording && mediaRecorder) {
        mediaRecorder.stop();
        startRecording(newStream);
      }
    } catch (error) {
      console.error('Error adjusting stream quality:', error);
      updateDebugInfo(`Error adjusting quality: ${error.message}`);
    }
  };

  // Manual quality adjustment
  const setQuality = async (quality) => {
    await adjustStreamQuality(quality, quality === 'audioOnly');
  };

  // Switch camera
  const switchCamera = async () => {
    if (cameras.length < 2) {
      setStatus('Only one camera available');
      return;
    }

    const newIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(newIndex);
    
    if (localStream) {
      // Stop current stream
      localStream.getTracks().forEach(track => track.stop());
    }

    try {
      setStatus('Switching camera...');
      const constraints = isAudioOnly ? 
        { audio: QUALITY_PRESETS.audioOnly.audio } :
        { 
          video: { deviceId: { exact: cameras[newIndex].deviceId }, ...QUALITY_PRESETS[currentQuality].video },
          audio: QUALITY_PRESETS[currentQuality].audio
        };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(newStream);
      localVideo.current.srcObject = newStream;
      
      // Update WebRTC tracks
      if (pc.current && pc.current.connectionState === 'connected') {
        const senders = pc.current.getSenders();
        const videoSender = senders.find(sender => sender.track?.kind === 'video');
        const audioSender = senders.find(sender => sender.track?.kind === 'audio');
        
        if (videoSender && !isAudioOnly) {
          videoSender.replaceTrack(newStream.getVideoTracks()[0]);
        }
        if (audioSender) {
          audioSender.replaceTrack(newStream.getAudioTracks()[0]);
        }
      }

      setStatus('Camera switched!');
    } catch (err) {
      setStatus('Error switching camera');
      console.error('Camera switch error:', err);
    }
  };

  const processPendingCandidates = async () => {
    if (pc.current && pc.current.remoteDescription && pendingCandidates.current.length > 0) {
      updateDebugInfo(`Processing ${pendingCandidates.current.length} pending candidates`);
      while (pendingCandidates.current.length > 0) {
        const candidate = pendingCandidates.current.shift();
        try {
          await pc.current.addIceCandidate(candidate);
          updateDebugInfo('Pending ICE candidate added');
        } catch (err) {
          console.error('Error adding pending candidate:', err);
          updateDebugInfo('Error adding pending candidate: ' + err.message);
        }
      }
    }
    
    // Also send any queued outgoing candidates if connection ID is now available
    if (connectionId.current && socket.current) {
      // This will be handled by the onicecandidate event which now checks for connectionId
    }
  };

  const updateDebugInfo = (info) => {
    setDebugInfo(prev => prev + '\n' + new Date().toLocaleTimeString() + ': ' + info);
  };

  const startWebRTC = async (streamer, shouldRecord = false) => {
    // Clean up any existing connections
    if (pc.current) {
      pc.current.close();
    }
    if (socket.current) {
      socket.current.disconnect();
    }
    if (qualityCheckInterval.current) {
      clearInterval(qualityCheckInterval.current);
    }

    setIsStreamer(streamer);
    setIsRecording(shouldRecord);
    setStatus('Connecting...');
    setDebugInfo('');
    setCurrentQuality('medium');
    setNetworkQuality('unknown');
    setIsAudioOnly(false);
    isProcessingSignal.current = false;
    pendingCandidates.current = [];
    
    // Only generate connection ID for streamers
    if (streamer) {
      connectionId.current = Date.now().toString();
      updateDebugInfo(`Generated connection ID: ${connectionId.current}`);
    } else {
      connectionId.current = null; // Will be set when offer is received
      updateDebugInfo('Waiting for streamer connection ID...');
    }

    updateDebugInfo(`Starting WebRTC as ${streamer ? 'streamer' : 'viewer'}`);

    try {
      socket.current = io(SIGNALING_SERVER_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000
      });

      updateDebugInfo('Socket.io connected');

      socket.current.on('connect', () => {
        updateDebugInfo('Socket connected with ID: ' + socket.current.id);
      });

      socket.current.on('connect_error', (error) => {
        updateDebugInfo('Socket connection error: ' + error.message);
        setStatus('Signaling connection failed');
      });

      socket.current.on('disconnect', (reason) => {
        updateDebugInfo('Socket disconnected: ' + reason);
        setStatus('Signaling disconnected');
      });

      pc.current = new window.RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      });

      updateDebugInfo('RTCPeerConnection created');

      // Join room based on role
      if (streamer) {
        socket.current.emit('streamer-join', ROOM_ID);
        updateDebugInfo('Joined room as streamer: ' + ROOM_ID);
      } else {
        socket.current.emit('join', ROOM_ID);
        updateDebugInfo('Joined room as viewer: ' + ROOM_ID);
      }

      // Handle streamer availability
      socket.current.on('streamer-available', (data) => {
        updateDebugInfo(`Streamer available: ${data.message} (${data.streamerCount} streamer(s))`);
        setStatus('Streamer detected! Waiting for connection...');
      });

      // Handle no streamers available
      socket.current.on('no-streamers', (data) => {
        updateDebugInfo(`No streamers: ${data.message}`);
        setStatus('No streamers available. Waiting for a streamer to join...');
      });

      socket.current.on('new-peer', async (data) => {
        updateDebugInfo(`New peer detected: ${data.peerId} (${data.isStreamer ? 'streamer' : 'viewer'})`);
        if (streamer && pc.current.signalingState === 'stable') {
          setStatus('Creating offer...');
          updateDebugInfo('Creating offer...');
          try {
            const offer = await pc.current.createOffer();
            await pc.current.setLocalDescription(offer);
            updateDebugInfo('Local description set');
            socket.current.emit('signal', { 
              room: ROOM_ID, 
              connectionId: connectionId.current,
              data: { type: 'offer', sdp: offer.sdp } 
            });
            updateDebugInfo('Offer sent');
          } catch (err) {
            console.error('Error creating offer:', err);
            updateDebugInfo('Error creating offer: ' + err.message);
            setStatus('Error creating offer');
          }
        }
      });

      socket.current.on('signal', async (data) => {
        updateDebugInfo(`Received signal: ${data.data.type} from ${data.fromPeer}`);
        
        // For viewers, use the connection ID from the offer
        if (data.data.type === 'offer' && !streamer) {
          connectionId.current = data.connectionId;
          updateDebugInfo(`Using connection ID from offer: ${connectionId.current}`);
        }
        
        if (!pc.current || data.connectionId !== connectionId.current) {
          updateDebugInfo('Ignoring signal - wrong connection ID');
          return;
        }

        if (isProcessingSignal.current) {
          updateDebugInfo('Signal processing in progress, skipping...');
          return;
        }

        try {
          isProcessingSignal.current = true;

          if (data.data.type === 'offer' && !streamer && pc.current.signalingState === 'stable') {
            setStatus('Receiving offer...');
            updateDebugInfo('Processing offer...');
            await pc.current.setRemoteDescription({ type: 'offer', sdp: data.data.sdp });
            updateDebugInfo('Remote description set');
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            updateDebugInfo('Answer created and set');
            socket.current.emit('signal', { 
              room: ROOM_ID, 
              connectionId: connectionId.current,
              data: { type: 'answer', sdp: answer.sdp } 
            });
            updateDebugInfo('Answer sent');
          } else if (data.data.type === 'answer' && streamer && pc.current.signalingState === 'have-local-offer') {
            setStatus('Receiving answer...');
            updateDebugInfo('Processing answer...');
            await pc.current.setRemoteDescription({ type: 'answer', sdp: data.data.sdp });
            updateDebugInfo('Remote description set from answer');
            await processPendingCandidates();
          } else if (data.data.type === 'candidate') {
            updateDebugInfo('Processing ICE candidate');
            if (pc.current.remoteDescription) {
              await pc.current.addIceCandidate(data.data.candidate);
              updateDebugInfo('ICE candidate added');
            } else {
              pendingCandidates.current.push(data.data.candidate);
              updateDebugInfo('ICE candidate queued');
            }
          }
        } catch (err) {
          console.error('Error processing signal:', err);
          updateDebugInfo('Error processing signal: ' + err.message);
          setStatus('Error processing signal');
        } finally {
          isProcessingSignal.current = false;
        }
      });

      pc.current.onicecandidate = (event) => {
        if (event.candidate && socket.current && connectionId.current) {
          updateDebugInfo('Sending ICE candidate');
          socket.current.emit('signal', { 
            room: ROOM_ID, 
            connectionId: connectionId.current,
            data: { type: 'candidate', candidate: event.candidate } 
          });
        } else if (event.candidate && !connectionId.current) {
          updateDebugInfo('ICE candidate available but no connection ID yet - queuing');
          pendingCandidates.current.push(event.candidate);
        }
      };

      pc.current.ontrack = (event) => {
        updateDebugInfo(`Received remote track: ${event.track.kind} (${event.track.id})`);
        updateDebugInfo(`Stream ID: ${event.streams[0].id}, Tracks: ${event.streams[0].getTracks().length}`);
        
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          updateDebugInfo(`Setting remote stream with ${stream.getTracks().length} tracks`);
          
          // Log track details
          stream.getTracks().forEach((track, index) => {
            updateDebugInfo(`Track ${index}: ${track.kind} - ${track.enabled ? 'enabled' : 'disabled'} - ${track.readyState}`);
          });
          
          setRemoteStream(stream);
          setStatus('Connected! Receiving stream...');
        } else {
          updateDebugInfo('Warning: No streams in track event');
        }
      };

      pc.current.oniceconnectionstatechange = () => {
        const state = pc.current.iceConnectionState;
        updateDebugInfo('ICE connection state: ' + state);
        console.log('ICE connection state:', state);
        if (state === 'connected') {
          setStatus('WebRTC connected!');
          setConnected(true);
          
          // Start network quality monitoring
          if (streamer) {
            qualityCheckInterval.current = setInterval(assessNetworkQuality, 5000);
            updateDebugInfo('Started network quality monitoring');
          }
        } else if (state === 'disconnected') {
          setStatus('Connection lost');
          setConnected(false);
        } else if (state === 'failed') {
          setStatus('Connection failed');
          setConnected(false);
        } else if (state === 'checking') {
          setStatus('Checking connection...');
        } else if (state === 'gathering') {
          setStatus('Gathering candidates...');
        }
      };

      pc.current.onsignalingstatechange = () => {
        const state = pc.current.signalingState;
        updateDebugInfo('Signaling state: ' + state);
        console.log('Signaling state:', state);
      };

      pc.current.onconnectionstatechange = () => {
        const state = pc.current.connectionState;
        updateDebugInfo('Connection state: ' + state);
        console.log('Connection state:', state);
      };

      if (streamer) {
        try {
          setStatus('Accessing camera/microphone...');
          updateDebugInfo('Requesting media access...');
          await getCameras(); // Get available cameras first
          
          // Start with medium quality
          const stream = await navigator.mediaDevices.getUserMedia({
            video: QUALITY_PRESETS.medium.video,
            audio: QUALITY_PRESETS.medium.audio
          });
          
          setLocalStream(stream);
          localVideo.current.srcObject = stream;
          updateDebugInfo('Local media stream obtained');
          stream.getTracks().forEach((track) => pc.current.addTrack(track, stream));
          updateDebugInfo('Tracks added to peer connection');

          if (shouldRecord) {
            startRecording(stream);
          }
        } catch (err) {
          setStatus('Error: Could not access camera/microphone');
          updateDebugInfo('Media access error: ' + err.message);
          console.error('getUserMedia error:', err);
        }
      } else {
        // For viewers, set initial status
        setStatus('Waiting for streamer to join...');
      }
    } catch (error) {
      updateDebugInfo('WebRTC setup error: ' + error.message);
      setStatus('Failed to setup WebRTC');
    }
  };

  const startRecording = (stream) => {
    // Clear previous chunks
    chunksRef.current = [];
    setChunks([]);
    
    // Check for supported MIME types
    const mimeTypes = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];
    
    let selectedMimeType = null;
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        console.log('LiveStream - Using MIME type:', mimeType);
        break;
      }
    }
    
    if (!selectedMimeType) {
      console.error('LiveStream - No supported video MIME type found');
      setStatus('Error: No supported video format found');
      return;
    }
    
    const recorder = new window.MediaRecorder(stream, {
      mimeType: selectedMimeType
    });
    
    setMediaRecorder(recorder);
    
    recorder.ondataavailable = (e) => {
      console.log('LiveStream - Data available:', e.data.size, 'bytes');
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        setChunks(prev => [...prev, e.data]);
      }
    };
    
    recorder.onstop = async () => {
      console.log('LiveStream - Recording stopped. Total chunks:', chunksRef.current.length);
      console.log('LiveStream - Total data size:', chunksRef.current.reduce((total, chunk) => total + chunk.size, 0), 'bytes');
      
      if (chunksRef.current.length === 0) {
        setStatus('Error: No recording data captured');
        console.error('LiveStream - No chunks available for recording');
        return;
      }
      
      const blob = new Blob(chunksRef.current, { type: selectedMimeType });
      console.log('LiveStream - Blob created:', blob.size, 'bytes');
      
      if (blob.size === 0) {
        setStatus('Error: Recording file is empty');
        console.error('LiveStream - Blob size is 0');
        return;
      }
      
      // Upload to backend
      const formData = new FormData();
      const filename = `live-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${selectedMimeType.includes('webm') ? 'webm' : 'mp4'}`;
      formData.append('file', blob, filename);
      try {
        const response = await fetch('http://10.28.159.141:5001/api/recordings', { 
          method: 'POST', 
          body: formData 
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('LiveStream - Upload successful:', result);
          setStatus('Recording saved! You can view it in the Playback page.');
        } else {
          const errorText = await response.text();
          console.error('LiveStream - Upload failed:', errorText);
          setStatus('Error saving recording');
        }
      } catch (err) {
        console.error('LiveStream - Upload error:', err);
        setStatus('Error saving recording');
      }
    };
    
    recorder.start(1000); // Request data every 1 second
    setStatus('Live streaming and recording...');
  };

  const stopStreaming = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (socket.current) {
      socket.current.disconnect();
    }
    if (pc.current) {
      pc.current.close();
    }
    if (qualityCheckInterval.current) {
      clearInterval(qualityCheckInterval.current);
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsStreamer(false);
    setIsRecording(false);
    setConnected(false);
    setStatus('Disconnected');
    setDebugInfo('');
    setCurrentQuality('medium');
    setNetworkQuality('unknown');
    setIsAudioOnly(false);
    isProcessingSignal.current = false;
    pendingCandidates.current = [];
    connectionId.current = null;
  };

  const openFullscreen = (videoRef, title) => {
    if (!videoRef.current) return;
    
    // Create fullscreen container
    const fullscreenContainer = document.createElement('div');
    fullscreenContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: black;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `;
    
    // Create title bar
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 20px;
      font-size: 18px;
      font-weight: bold;
      text-align: center;
      z-index: 10001;
    `;
    titleBar.textContent = title;
    
    // Create video container
    const videoContainer = document.createElement('div');
    videoContainer.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    `;
    
    // Clone the video element
    const video = videoRef.current.cloneNode(true);
    video.style.cssText = `
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
    `;
    video.controls = true;
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕';
    closeButton.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      font-size: 20px;
      cursor: pointer;
      z-index: 10002;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Add fullscreen toggle button
    const fullscreenButton = document.createElement('button');
    fullscreenButton.innerHTML = '⛶';
    fullscreenButton.style.cssText = `
      position: absolute;
      top: 20px;
      right: 70px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      font-size: 20px;
      cursor: pointer;
      z-index: 10002;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Add event listeners
    closeButton.addEventListener('click', () => {
      document.body.removeChild(fullscreenContainer);
    });
    
    fullscreenButton.addEventListener('click', () => {
      if (video.requestFullscreen) {
        video.requestFullscreen();
      } else if (video.webkitRequestFullscreen) {
        video.webkitRequestFullscreen();
      } else if (video.msRequestFullscreen) {
        video.msRequestFullscreen();
      }
    });
    
    // Close on escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(fullscreenContainer);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Add elements to container
    videoContainer.appendChild(video);
    fullscreenContainer.appendChild(titleBar);
    fullscreenContainer.appendChild(videoContainer);
    fullscreenContainer.appendChild(closeButton);
    fullscreenContainer.appendChild(fullscreenButton);
    
    // Add to body
    document.body.appendChild(fullscreenContainer);
    
    // Focus on video for keyboard controls
    video.focus();
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4 text-blue-700">Live Stream</h2>
      
      <div className="mb-4 p-3 bg-gray-100 rounded">
        <p className="text-sm text-gray-700">Status: {status}</p>
        <p className="text-sm text-gray-700">Quality: {currentQuality} {isAudioOnly && '(Audio Only)'}</p>
        <p className="text-sm text-gray-700">Network: {networkQuality}</p>
        {cameras.length > 1 && (
          <p className="text-xs text-gray-500 mt-1">
            Available cameras: {cameras.length} | Current: {cameras[currentCameraIndex]?.label || 'Camera ' + (currentCameraIndex + 1)}
          </p>
        )}
      </div>

      {!connected && !isStreamer && (
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => startWebRTC(true, false)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow"
          >
            Start Live Stream
          </button>
          <button
            onClick={() => startWebRTC(true, true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
          >
            Live Stream + Record
          </button>
          <button
            onClick={() => startWebRTC(false, false)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded shadow"
          >
            View Stream
          </button>
        </div>
      )}

      {isStreamer && (
        <div className="flex gap-4 mb-4 flex-wrap">
          <button
            onClick={stopStreaming}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow"
          >
            Stop Streaming
          </button>
          {cameras.length > 1 && (
            <button
              onClick={switchCamera}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded shadow"
            >
              Switch Camera
            </button>
          )}
          
          {/* Manual Quality Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => setQuality('high')}
              className={`px-3 py-2 rounded shadow text-sm ${currentQuality === 'high' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-700'}`}
            >
              High
            </button>
            <button
              onClick={() => setQuality('medium')}
              className={`px-3 py-2 rounded shadow text-sm ${currentQuality === 'medium' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-700'}`}
            >
              Medium
            </button>
            <button
              onClick={() => setQuality('low')}
              className={`px-3 py-2 rounded shadow text-sm ${currentQuality === 'low' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-700'}`}
            >
              Low
            </button>
            <button
              onClick={() => setQuality('audioOnly')}
              className={`px-3 py-2 rounded shadow text-sm ${currentQuality === 'audioOnly' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-700'}`}
            >
              Audio Only
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isStreamer && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Your Stream (Local)</h3>
              <button
                onClick={() => openFullscreen(localVideo, 'Local Stream')}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm shadow flex items-center gap-1"
              >
                <span>⛶</span>
                <span>Fullscreen</span>
              </button>
            </div>
            <div className="relative">
              <video
                ref={localVideo}
                autoPlay
                playsInline
                muted
                className="rounded-lg shadow-lg border-2 border-blue-200 w-full h-64 bg-black"
              />
            </div>
            {isAudioOnly && (
              <div className="mt-2 p-2 bg-yellow-100 rounded text-center">
                <p className="text-yellow-800 text-sm">Audio Only Mode - Poor Network Detected</p>
              </div>
            )}
          </div>
        )}
        
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Remote Stream</h3>
            {remoteStream && (
              <button
                onClick={() => openFullscreen(remoteVideo, 'Remote Stream')}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm shadow flex items-center gap-1"
              >
                <span>⛶</span>
                <span>Fullscreen</span>
              </button>
            )}
          </div>
          <div className="relative">
            <video
              ref={remoteVideo}
              autoPlay
              playsInline
              className="rounded-lg shadow-lg border-2 border-blue-200 w-full h-64 bg-black"
              onLoadStart={() => updateDebugInfo('Remote video load started')}
              onLoadedData={() => updateDebugInfo('Remote video data loaded')}
              onCanPlayThrough={() => updateDebugInfo('Remote video can play through')}
              onPlaying={() => updateDebugInfo('Remote video playing')}
              onPause={() => updateDebugInfo('Remote video paused')}
              onEnded={() => updateDebugInfo('Remote video ended')}
              onAbort={() => updateDebugInfo('Remote video aborted')}
              onEmptied={() => updateDebugInfo('Remote video emptied')}
              onSuspend={() => updateDebugInfo('Remote video suspended')}
            />
          </div>
          {!remoteStream && !isStreamer && (
            <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
              <p className="text-gray-500">Waiting for stream...</p>
            </div>
          )}
          {remoteStream && (
            <div className="mt-2 p-2 bg-green-100 rounded text-center">
              <p className="text-green-800 text-sm">
                Stream active: {remoteStream.getTracks().length} tracks | 
                Video: {remoteStream.getVideoTracks().length} | 
                Audio: {remoteStream.getAudioTracks().length}
              </p>
            </div>
          )}
        </div>
      </div>

      {isRecording && (
        <div className="mt-4 p-3 bg-red-100 rounded">
          <p className="text-red-700 text-sm">🔴 Recording in progress...</p>
        </div>
      )}

      {/* Debug Information */}
      <div className="mt-6 p-4 bg-gray-900 text-green-400 rounded text-xs font-mono max-h-40 overflow-y-auto">
        <h4 className="font-semibold mb-2">Debug Info:</h4>
        <pre>{debugInfo || 'No debug info yet...'}</pre>
      </div>
    </div>
  );
};

export default LiveStream; 