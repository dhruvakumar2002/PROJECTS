import React, { useRef, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const API_URL = 'http://10.28.159.141:5001/api/recordings';

// Quality presets for adaptive recording
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

const Record = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [stream, setStream] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [currentQuality, setCurrentQuality] = useState('medium');
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [networkQuality, setNetworkQuality] = useState('unknown');
  const [recordingTime, setRecordingTime] = useState(0);
  const [status, setStatus] = useState('Ready to record');

  const videoRef = useRef();
  const recordingTimer = useRef(null);
  const networkCheckInterval = useRef(null);
  const streamStateCheck = useRef(null);
  const keepAliveInterval = useRef(null);
  const chunksRef = useRef([]); // Use ref to store chunks

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

  // Assess network quality for recording
  const assessNetworkQuality = async () => {
    try {
      // Simple network quality assessment for recording
      const startTime = performance.now();
      const response = await fetch(API_URL, { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      const endTime = performance.now();
      const latency = endTime - startTime;

      let newQuality = currentQuality;
      let newAudioOnly = isAudioOnly;

      if (latency > 1000 || !response.ok) {
        // Poor network - switch to audio only
        newQuality = 'audioOnly';
        newAudioOnly = true;
        setNetworkQuality('poor');
      } else if (latency > 500) {
        // Medium network - use low quality
        newQuality = 'low';
        newAudioOnly = false;
        setNetworkQuality('medium');
      } else if (latency > 200) {
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
        await adjustRecordingQuality(newQuality, newAudioOnly);
      }

      setStatus(`Network: ${networkQuality} (${latency.toFixed(0)}ms latency)`);
    } catch (error) {
      console.error('Error assessing network quality:', error);
      // If network check fails, assume poor network and switch to audio only
      if (currentQuality !== 'audioOnly') {
        await adjustRecordingQuality('audioOnly', true);
      }
    }
  };

  // Adjust recording quality based on network conditions
  const adjustRecordingQuality = async (quality, audioOnly = false) => {
    if (isRecording) {
      setStatus('Cannot adjust quality while recording');
      return;
    }

    try {
      setStatus(`Adjusting quality to: ${quality}${audioOnly ? ' (audio only)' : ''}`);
      
      // Stop current stream if exists
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Get new stream with adjusted quality
      const constraints = audioOnly ? 
        { audio: QUALITY_PRESETS.audioOnly.audio } :
        { 
          video: { 
            deviceId: cameras[currentCameraIndex] ? { exact: cameras[currentCameraIndex].deviceId } : undefined,
            ...QUALITY_PRESETS[quality].video 
          },
          audio: QUALITY_PRESETS[quality].audio
        };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      setCurrentQuality(quality);
      setIsAudioOnly(audioOnly);
      setStatus(`Quality adjusted to ${quality}`);
    } catch (error) {
      console.error('Error adjusting recording quality:', error);
      setStatus(`Error adjusting quality: ${error.message}`);
    }
  };

  // Manual quality adjustment
  const setQuality = async (quality) => {
    await adjustRecordingQuality(quality, quality === 'audioOnly');
  };

  // Switch camera
  const switchCamera = async () => {
    if (cameras.length < 2) {
      setStatus('Only one camera available');
      return;
    }

    if (isRecording) {
      setStatus('Cannot switch camera while recording');
      return;
    }

    const newIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(newIndex);
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      setStatus('Switching camera...');
      const constraints = isAudioOnly ? 
        { audio: QUALITY_PRESETS.audioOnly.audio } :
        { 
          video: { 
            deviceId: { exact: cameras[newIndex].deviceId }, 
            ...QUALITY_PRESETS[currentQuality].video 
          },
          audio: QUALITY_PRESETS[currentQuality].audio
        };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      videoRef.current.srcObject = newStream;
      setStatus('Camera switched!');
    } catch (err) {
      setStatus('Error switching camera');
      console.error('Camera switch error:', err);
    }
  };

  // Start recording
  const startRecording = async () => {
    if (!stream) {
      setStatus('No media stream available');
      return;
    }

    try {
      setStatus('Starting recording...');
      
      // Reset restart flag for new recording session
      window.recordingRestarted = false;
      
      // Start network quality monitoring
      networkCheckInterval.current = setInterval(assessNetworkQuality, 10000);
      
      // Clear previous chunks
      chunksRef.current = [];
      setChunks([]);
      
      // Detect browser for potential limitations
      const userAgent = navigator.userAgent;
      const isChrome = userAgent.includes('Chrome');
      const isFirefox = userAgent.includes('Firefox');
      const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
      
      console.log('Browser detection:', { isChrome, isFirefox, isSafari, userAgent });
      
      // Check for supported MIME types with browser-specific preferences
      const mimeTypes = isChrome ? [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8',
        'video/webm'
      ] : isFirefox ? [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp8',
        'video/webm'
      ] : isSafari ? [
        'video/mp4',
        'video/webm'
      ] : [
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
          console.log('Using MIME type:', mimeType);
          break;
        }
      }
      
      if (!selectedMimeType) {
        throw new Error('No supported video MIME type found');
      }
      
      console.log('Starting MediaRecorder with:', {
        mimeType: selectedMimeType,
        streamTracks: stream.getTracks().length,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        browser: { isChrome, isFirefox, isSafari }
      });
      
      const recorder = new window.MediaRecorder(stream, {
        mimeType: selectedMimeType
      });
      
      setMediaRecorder(recorder);
      setRecordingTime(0);
      
      recorder.ondataavailable = (e) => {
        console.log('Data available:', e.data.size, 'bytes, type:', e.data.type);
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          setChunks(prev => [...prev, e.data]);
        } else {
          console.warn('Received empty data chunk');
        }
      };
      
      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        console.error('Error details:', {
          name: event.error.name,
          message: event.error.message,
          code: event.error.code
        });
        setStatus(`Recording error: ${event.error.name} - ${event.error.message}`);
        setIsRecording(false);
        
        // Clear intervals
        if (networkCheckInterval.current) {
          clearInterval(networkCheckInterval.current);
        }
        if (recordingTimer.current) {
          clearInterval(recordingTimer.current);
        }
        if (streamStateCheck.current) {
          clearInterval(streamStateCheck.current);
        }
        if (keepAliveInterval.current) {
          clearInterval(keepAliveInterval.current);
        }
      };
      
      recorder.onstart = () => {
        console.log('MediaRecorder started successfully');
        console.log('Recorder state:', recorder.state);
        setStatus('Recording started successfully');
      };
      
      recorder.onpause = () => {
        console.log('MediaRecorder paused');
        setStatus('Recording paused');
      };
      
      recorder.onresume = () => {
        console.log('MediaRecorder resumed');
        setStatus('Recording resumed');
      };
      
      recorder.onstop = async () => {
        console.log('Recording stopped. Total chunks:', chunksRef.current.length);
        console.log('Total data size:', chunksRef.current.reduce((total, chunk) => total + chunk.size, 0), 'bytes');
        console.log('Final recorder state:', recorder.state);
        
        if (networkCheckInterval.current) {
          clearInterval(networkCheckInterval.current);
        }
        if (recordingTimer.current) {
          clearInterval(recordingTimer.current);
        }
        if (streamStateCheck.current) {
          clearInterval(streamStateCheck.current);
        }
        if (keepAliveInterval.current) {
          clearInterval(keepAliveInterval.current);
        }
        
        if (chunksRef.current.length === 0) {
          setStatus('Error: No recording data captured');
          console.error('No chunks available for recording');
          return;
        }
        
        const blob = new Blob(chunksRef.current, { type: selectedMimeType });
        console.log('Blob created:', blob.size, 'bytes');
        
        if (blob.size === 0) {
          setStatus('Error: Recording file is empty');
          console.error('Blob size is 0');
          return;
        }
        
        // Upload to backend only - no automatic download
        const formData = new FormData();
        const filename = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${selectedMimeType.includes('webm') ? 'webm' : 'mp4'}`;
        formData.append('file', blob, filename);
        
        try {
          setStatus('Uploading recording...');
          const response = await fetch(API_URL, { 
            method: 'POST', 
            body: formData 
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('Upload successful:', result);
            setStatus('Recording saved successfully! You can view it in the Playback page.');
          } else {
            const errorText = await response.text();
            console.error('Upload failed:', errorText);
            setStatus('Error saving recording to server');
          }
        } catch (err) {
          setStatus('Error uploading recording');
          console.error('Upload error:', err);
        }
      };
      
      // Try with a larger timeslice to prevent browser limitations
      // Some browsers have issues with very small timeslices
      const timeslice = isSafari ? 10000 : 5000; // 10 seconds for Safari, 5 for others
      recorder.start(timeslice);
      setIsRecording(true);
      setStatus('Recording...');
      
      // Start recording timer
      recordingTimer.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Monitor stream state
      const streamStateCheck = setInterval(() => {
        if (stream) {
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];
          
          if (videoTrack && videoTrack.readyState === 'ended') {
            console.error('Video track ended unexpectedly');
            setStatus('Video track ended - attempting to restart stream...');
            
            // Try to restart the stream instead of stopping recording
            restartStream();
            return;
          }
          
          if (audioTrack && audioTrack.readyState === 'ended') {
            console.error('Audio track ended unexpectedly');
            setStatus('Audio track ended - attempting to restart stream...');
            
            // Try to restart the stream instead of stopping recording
            restartStream();
            return;
          }
          
          // Check MediaRecorder state
          if (recorder.state === 'inactive') {
            console.error('MediaRecorder became inactive unexpectedly');
            setStatus('MediaRecorder stopped unexpectedly');
            setIsRecording(false);
            clearInterval(streamStateCheck);
          }
          
          // Check for memory issues
          if (performance.memory) {
            const memoryUsage = performance.memory;
            const memoryPercent = (memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit) * 100;
            if (memoryPercent > 80) {
              console.warn('High memory usage detected:', memoryPercent.toFixed(1) + '%');
            }
          }
          
          // Log stream state every 5 seconds for more frequent monitoring
          if (recordingTime % 5 === 0) {
            console.log('Stream state check:', {
              videoTrack: videoTrack ? { readyState: videoTrack.readyState, enabled: videoTrack.enabled } : 'none',
              audioTrack: audioTrack ? { readyState: audioTrack.readyState, enabled: audioTrack.enabled } : 'none',
              recorderState: recorder.state,
              recordingTime: recordingTime,
              chunksCount: chunksRef.current.length,
              totalDataSize: chunksRef.current.reduce((total, chunk) => total + chunk.size, 0),
              memoryUsage: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
              } : 'Not available'
            });
          }
          
          // Auto-restart if recording stops unexpectedly (but only once)
          if (recordingTime > 10 && recorder.state === 'inactive' && !window.recordingRestarted) {
            console.warn('Recording stopped unexpectedly, attempting restart...');
            window.recordingRestarted = true;
            setStatus('Recording stopped unexpectedly, attempting restart...');
            
            // Stop current recording
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
            
            // Clear intervals
            clearInterval(streamStateCheck);
            if (recordingTimer.current) {
              clearInterval(recordingTimer.current);
            }
            
            // Restart recording after a short delay
            setTimeout(() => {
              startRecording();
            }, 1000);
          }
        }
      }, 1000);
      
      // Store the interval reference for cleanup
      streamStateCheck.current = streamStateCheck;
      
      // Add track event listeners to detect when tracks end
      stream.getTracks().forEach(track => {
        track.onended = () => {
          console.warn(`${track.kind} track ended:`, track.id);
          setStatus(`${track.kind} track ended - attempting to restart...`);
          restartStream();
        };
        
        track.onmute = () => {
          console.warn(`${track.kind} track muted:`, track.id);
        };
        
        track.onunmute = () => {
          console.log(`${track.kind} track unmuted:`, track.id);
        };
      });
      
      // Keep-alive mechanism to prevent track suspension
      const keepAliveInterval = setInterval(() => {
        if (stream && isRecording) {
          // Ensure video element is playing to keep tracks active
          if (videoRef.current && videoRef.current.paused) {
            videoRef.current.play().catch(e => console.log('Keep-alive video play error:', e));
          }
          
          // Log track health
          stream.getTracks().forEach(track => {
            if (track.readyState === 'ended') {
              console.warn(`Track ${track.kind} ended during keep-alive check`);
            }
          });
        }
      }, 2000); // Check every 2 seconds
      
      // Store keep-alive interval for cleanup
      keepAliveInterval.current = keepAliveInterval;
      
    } catch (error) {
      setStatus('Error starting recording');
      console.error('Recording error:', error);
    }
  };

  // Function to restart the stream when tracks end
  const restartStream = async () => {
    if (!isRecording) return;
    
    try {
      setStatus('Restarting stream...');
      console.log('Attempting to restart stream...');
      
      // Stop current recorder
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      
      // Clear all intervals
      if (networkCheckInterval.current) {
        clearInterval(networkCheckInterval.current);
      }
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
      if (streamStateCheck.current) {
        clearInterval(streamStateCheck.current);
      }
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current);
      }
      
      // Stop current stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Get new stream
      const constraints = isAudioOnly ? 
        { audio: QUALITY_PRESETS.audioOnly.audio } :
        { 
          video: { 
            deviceId: cameras[currentCameraIndex] ? { exact: cameras[currentCameraIndex].deviceId } : undefined,
            ...QUALITY_PRESETS[currentQuality].video 
          },
          audio: QUALITY_PRESETS[currentQuality].audio
        };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      
      // Restart recording with new stream
      setTimeout(() => {
        startRecording();
      }, 500);
      
    } catch (error) {
      console.error('Error restarting stream:', error);
      setStatus('Failed to restart stream - stopping recording');
      setIsRecording(false);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setStatus('Stopping recording...');
    }
  };

  // Initialize camera access
  useEffect(() => {
    const initCamera = async () => {
      try {
        setStatus('Accessing camera...');
        await getCameras();
        
        // Start with medium quality
        const initialStream = await navigator.mediaDevices.getUserMedia({
          video: QUALITY_PRESETS.medium.video,
          audio: QUALITY_PRESETS.medium.audio
        });
        
        setStream(initialStream);
        if (videoRef.current) {
          videoRef.current.srcObject = initialStream;
          // Keep video element active to prevent track ending
          videoRef.current.play().catch(e => console.log('Video play error:', e));
        }
        setStatus('Camera ready');
      } catch (err) {
        setStatus('Error accessing camera/microphone');
        console.error('Camera access error:', err);
      }
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (networkCheckInterval.current) {
        clearInterval(networkCheckInterval.current);
      }
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
      if (streamStateCheck.current) {
        clearInterval(streamStateCheck.current);
      }
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current);
      }
    };
  }, []);

  // Format recording time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4 text-blue-700">Record Video</h2>
      
      <div className="mb-4 p-3 bg-gray-100 rounded">
        <p className="text-sm text-gray-700">Status: {status}</p>
        <p className="text-sm text-gray-700">Quality: {currentQuality} {isAudioOnly && '(Audio Only)'}</p>
        <p className="text-sm text-gray-700">Network: {networkQuality}</p>
        {isRecording && (
          <p className="text-sm text-red-600 font-semibold">Recording: {formatTime(recordingTime)}</p>
        )}
        {cameras.length > 1 && (
          <p className="text-xs text-gray-500 mt-1">
            Available cameras: {cameras.length} | Current: {cameras[currentCameraIndex]?.label || 'Camera ' + (currentCameraIndex + 1)}
          </p>
        )}
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg shadow-lg font-semibold"
          >
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg shadow-lg font-semibold"
          >
            Stop Recording
          </button>
        )}
        
        {cameras.length > 1 && (
          <button
            onClick={switchCamera}
            disabled={isRecording}
            className={`px-4 py-3 rounded-lg shadow-lg font-semibold ${
              isRecording 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
            }`}
          >
            Switch Camera
          </button>
        )}
        
        {/* Manual Quality Controls */}
        <div className="flex gap-2">
          <button
            onClick={() => setQuality('high')}
            disabled={isRecording}
            className={`px-3 py-2 rounded shadow text-sm ${
              isRecording 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : currentQuality === 'high' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
          >
            High
          </button>
          <button
            onClick={() => setQuality('medium')}
            disabled={isRecording}
            className={`px-3 py-2 rounded shadow text-sm ${
              isRecording 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : currentQuality === 'medium' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
          >
            Medium
          </button>
          <button
            onClick={() => setQuality('low')}
            disabled={isRecording}
            className={`px-3 py-2 rounded shadow text-sm ${
              isRecording 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : currentQuality === 'low' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
          >
            Low
          </button>
          <button
            onClick={() => setQuality('audioOnly')}
            disabled={isRecording}
            className={`px-3 py-2 rounded shadow text-sm ${
              isRecording 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : currentQuality === 'audioOnly' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
          >
            Audio Only
          </button>
        </div>
      </div>

      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="rounded-lg shadow-lg border-2 border-blue-200 w-full h-96 bg-black"
        />
        
        {isAudioOnly && (
          <div className="absolute top-4 left-4 p-2 bg-yellow-100 rounded text-center">
            <p className="text-yellow-800 text-sm font-semibold">Audio Only Mode</p>
            <p className="text-yellow-700 text-xs">Poor Network Detected</p>
          </div>
        )}
        
        {isRecording && (
          <div className="absolute top-4 right-4 p-2 bg-red-600 rounded text-white">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              <span className="font-semibold">REC</span>
            </div>
          </div>
        )}
      </div>

      {isRecording && (
        <div className="mt-4 p-3 bg-red-100 rounded">
          <p className="text-red-700 text-sm">🔴 Recording in progress... {formatTime(recordingTime)}</p>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded">
        <h3 className="font-semibold text-blue-800 mb-2">Adaptive Quality Features:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Automatic quality adjustment based on network conditions</li>
          <li>• Fallback to audio-only recording in poor network</li>
          <li>• Manual quality control for optimal recording</li>
          <li>• Real-time network quality monitoring</li>
          <li>• Automatic camera switching support</li>
        </ul>
      </div>
    </div>
  );
};

export default Record; 