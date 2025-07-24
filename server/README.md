# Server (Backend)

This is the Node.js + Express backend for the Realtime Audio and Video Capturing and Streaming System.

## Features
- WebSocket signaling for WebRTC
- REST API for uploading and retrieving recordings
- Stores audio/video in MongoDB GridFS

## Setup
1. Install dependencies:
   ```
   npm install
   ```
2. Start the server:
   ```
   npm start
   ```

## Notes
- Requires MongoDB to be running.
- Used by the web client for signaling and media storage. 