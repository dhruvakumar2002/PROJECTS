import React, { useEffect, useState } from 'react';

//const API_URL = 'http://10.28.159.141:5001/api/recordings'; //http://10.28.159.141:5001/
const API_BASE = (process.env.REACT_APP_API_BASE || process.env.REACT_APP_SIGNALING_URL || 'http://10.28.159.141:5001').replace(/\/$/, '');
const API_URL = `${API_BASE}/api/recordings`;

// Quality options for download
const QUALITY_OPTIONS = [
  { value: 'original', label: 'Original Quality', description: 'Download as recorded' },
  { value: 'high', label: 'High Quality (720p)', description: '1280x720, 2.5 Mbps' },
  { value: 'medium', label: 'Medium Quality (480p)', description: '854x480, 1 Mbps' },
  { value: 'low', label: 'Low Quality (360p)', description: '640x360, 500 Kbps' },
  { value: 'audio', label: 'Audio Only', description: 'MP3 format, 128 Kbps' },
];

// Format file size
const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const Playback = () => {
  const [recordings, setRecordings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [downloadId, setDownloadId] = useState(null);

  const fetchRecordings = async () => {
    try {
      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken') || ''}` }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setRecordings(data);
    } catch (error) {
      console.error('Error fetching recordings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, []);

  const deleteRecording = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recording?')) {
      return;
    }

    setDeleting(id);
    try {
      console.log('Attempting to delete recording:', id);
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken') || ''}`
        },
      });
      
      console.log('Delete response status:', response.status);
      console.log('Delete response ok:', response.ok);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Delete response:', result);
        
        // Remove from local state
        setRecordings(recordings.filter(rec => rec._id !== id));
        if (selected === id) {
          setSelected(null);
        }
        alert('Recording deleted successfully!');
      } else {
        const errorText = await response.text();
        console.error('Delete failed:', errorText);
        alert(`Failed to delete recording: ${errorText}`);
      }
    } catch (error) {
      console.error('Error deleting recording:', error);
      alert(`Error deleting recording: ${error.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (id) => {
    setDownloadId(id);
    setShowQualityModal(true);
  };

  const downloadWithQuality = (quality) => {
    setShowQualityModal(false);
    const token = localStorage.getItem('authToken') || '';
    const url = `${API_URL}/${downloadId}?quality=${quality}&token=${encodeURIComponent(token)}`;
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `recording-${quality}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${quality === 'audio' ? 'mp3' : 'webm'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const playInFullscreen = (recordingId) => {
    // Create a fullscreen video player
    const videoUrl = `${API_URL}/${recordingId}`;
    
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
      align-items: center;
      justify-content: center;
    `;
    
    // Create video element
    const video = document.createElement('video');
    video.style.cssText = `
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
    `;
    video.src = videoUrl;
    video.controls = true;
    video.autoplay = true;
    
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
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Add event listeners
    closeButton.addEventListener('click', () => {
      document.body.removeChild(fullscreenContainer);
    });
    
    // Close on escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(fullscreenContainer);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Close on video end
    video.addEventListener('ended', () => {
      document.body.removeChild(fullscreenContainer);
      document.removeEventListener('keydown', handleEscape);
    });
    
    // Add elements to container
    fullscreenContainer.appendChild(video);
    fullscreenContainer.appendChild(closeButton);
    
    // Add to body
    document.body.appendChild(fullscreenContainer);
    
    // Focus on video for keyboard controls
    video.focus();
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 bg-slate-800 rounded-lg shadow-lg p-8 text-gray-100">
      <h2 className="text-3xl font-bold mb-6 text-sky-400">Playback Recordings</h2>
      
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <svg className="animate-spin h-8 w-8 text-sky-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        </div>
      ) : (
        <div className="space-y-4">
          {recordings.length === 0 ? (
            <div className="text-center text-gray-300 py-8">
              <p className="text-lg">No recordings found.</p>
              <p className="text-sm">Record some videos to see them here!</p>
            </div>
          ) : (
            recordings.map((rec) => (
              <div
                key={rec._id}
                className="bg-slate-700 rounded-lg shadow-md p-6 border border-slate-600 hover:shadow-lg transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-100 mb-2">
                      {rec.filename || `Recording ${rec._id.slice(-8)}`}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-300">
                      <div>
                        <span className="font-medium">Size:</span> {formatBytes(rec.length)}
                      </div>
                      <div>
                        <span className="font-medium">Uploaded:</span> {rec.uploadDate ? new Date(rec.uploadDate).toLocaleDateString() : 'Unknown'}
                      </div>
                      <div>
                        <span className="font-medium">Time:</span> {rec.uploadDate ? new Date(rec.uploadDate).toLocaleTimeString() : 'Unknown'}
                      </div>
                      <div>
                        <span className="font-medium">ID:</span> {rec._id.slice(-8)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4 md:mt-0">
                    <button
                      onClick={() => playInFullscreen(rec._id)}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg shadow flex items-center gap-2"
                    >
                      <span>▶️</span>
                      <span>Play Fullscreen</span>
                    </button>
                    
                    <button
                      onClick={() => setSelected(rec._id)}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg shadow flex items-center gap-2"
                    >
                      <span>📺</span>
                      <span>Play in Player</span>
                    </button>
                    
                    <button
                      onClick={() => handleDownload(rec._id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow flex items-center gap-2"
                    >
                      <span>⬇️</span>
                      <span>Download</span>
                    </button>
                    
                    <button
                      onClick={() => deleteRecording(rec._id)}
                      disabled={deleting === rec._id}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-lg shadow flex items-center gap-2"
                    >
                      {deleting === rec._id ? (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                      ) : (
                        <span>🗑️</span>
                      )}
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      
      {selected && (
        <div className="mt-8 p-6 bg-slate-700 rounded-lg">
          <h3 className="font-semibold text-xl mb-4 text-gray-100">Now Playing</h3>
          <video
            src={`${API_URL}/${selected}?token=${encodeURIComponent(localStorage.getItem('authToken') || '')}`}
            controls
            autoPlay
            className="rounded-lg border border-slate-600 w-full h-96 bg-black shadow-lg"
          />
        </div>
      )}

      {/* Quality Selection Modal */}
      {showQualityModal && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-slate-700">
            <h3 className="text-xl font-bold mb-4 text-gray-100">Select Download Quality</h3>
            <p className="text-gray-300 mb-6">Choose the quality for your download:</p>
            
            <div className="space-y-3">
              {QUALITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => downloadWithQuality(option.value)}
                  className="w-full p-4 text-left border border-slate-700 rounded-lg hover:bg-slate-700/60 hover:border-slate-500 transition-colors text-gray-100"
                >
                  <div className="font-semibold text-gray-800">{option.label}</div>
                  <div className="text-sm text-gray-600">{option.description}</div>
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowQualityModal(false)}
              className="mt-6 w-full px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Playback; 