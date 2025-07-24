# Realtime Audio and Video Capturing and Streaming System

## Overview
This project enables real-time audio and video recording and live streaming from one device (mobile or laptop) to another (laptop or mobile). It also allows storing recorded audio/video in a database and provides a web UI for live viewing and playback.

## Features
- Record audio and video from browser (mobile/laptop)
- Live stream audio/video to another device in real time
- Store recorded audio/video in MongoDB (with metadata)
- Web UI for live stream and playback

## Tech Stack
- **Frontend:** React + Tailwind CSS
- **Backend:** Node.js + Express
- **Real-Time:** WebRTC (P2P streaming), WebSocket (signaling)
- **Database:** MongoDB (GridFS for media storage)
- **Media Handling:** MediaRecorder API (browser-side recording)

## Architecture
- WebRTC for real-time streaming
- WebSocket for signaling
- REST API for uploading and retrieving recordings
- MongoDB GridFS for storing large media files

## Directory Structure
- `client/` — React + Tailwind web UI
- `server/` — Node.js + Express backend 