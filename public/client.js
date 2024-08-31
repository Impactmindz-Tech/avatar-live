const socket = io('https://db43-2401-4900-1c71-853d-7474-9acc-700a-f578.ngrok-free.app'); // Replace with your ngrok URL
const localVideo = document.getElementById('localVideo');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const stopBtn = document.getElementById('stopBtn');
const exitBtn = document.getElementById('exitBtn');
const roomInput = document.getElementById('roomInput');
const errorMessage = document.getElementById('error-message');
const videosContainer = document.getElementById('videos');

let localStream;
let peerConnections = {};
let roomId;
let isBroadcaster = false;

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

createBtn.onclick = createRoom;
joinBtn.onclick = joinRoom;
stopBtn.onclick = stopStream;
exitBtn.onclick = exitRoom;

async function getUserMedia(audio = true) {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: audio });
  } catch (error) {
    handleMediaError(error);
  }
}

async function createRoom() {
  console.log('Create room button clicked');
  
  if (!socket.connected) {
    console.error('Socket is not connected');
    displayError('Unable to create room: Socket connection failed.');
    return;
  }

  try {
    roomId = roomInput.value || Math.random().toString(36).substr(2, 3); // Use a very short room ID for testing
    console.log(`Attempting to create room with ID: ${roomId}`);
    socket.emit('create', roomId);
  } catch (error) {
    displayError(`Create Room Error: ${error.message}`);
  }
}

function joinRoom() {
  roomId = roomInput.value;
  if (roomId) {
    socket.emit('join', roomId);
  } else {
    errorMessage.textContent = 'Please enter a room ID';
  }
}

async function stopStream() {
  if (isBroadcaster && localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    socket.emit('stop', roomId);
    videosContainer.innerHTML = ''; // Clear video container
  }
}

function exitRoom() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  socket.emit('exit', roomId);
  videosContainer.innerHTML = ''; // Clear video container
  errorMessage.textContent = 'Exited the room';
  createBtn.disabled = false;
  joinBtn.disabled = false;
}

socket.on('created', async (room) => {
  console.log(`Room created: ${room}`);
  errorMessage.textContent = `Created room ${room}. Waiting for viewers...`;
  isBroadcaster = true;
  localStream = await getUserMedia(); // Audio enabled for broadcaster
  localVideo.srcObject = localStream;
  stopBtn.disabled = false; // Enable Stop Stream button
});

socket.on('joined', async (room) => {
  console.log(`Joined room: ${room}`);
  errorMessage.textContent = `Joined room ${room}`;
  isBroadcaster = false;
  localStream = await getUserMedia(false); // Audio disabled for joining users
  localVideo.srcObject = localStream;
});

socket.on('full', (room) => {
  errorMessage.textContent = `Room ${room} is full`;
});

socket.on('viewer', (viewerId) => {
  const peerConnection = new RTCPeerConnection(configuration);
  peerConnections[viewerId] = peerConnection;

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate, roomId, viewerId);
    }
  };

  peerConnection.createOffer()
    .then(offer => peerConnection.setLocalDescription(offer))
    .then(() => {
      socket.emit('offer', peerConnection.localDescription, roomId, viewerId);
    });
});

socket.on('offer', async (offer, broadcasterId) => {
  const peerConnection = new RTCPeerConnection(configuration);
  peerConnections[broadcasterId] = peerConnection;

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate, roomId, broadcasterId);
    }
  };

  peerConnection.ontrack = (event) => {
    const remoteVideo = document.createElement('video');
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.autoplay = true;
    remoteVideo.playsinline = true;
    videosContainer.innerHTML = ''; // Clear previous videos
    videosContainer.appendChild(remoteVideo);
  };

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer, roomId, broadcasterId);
});

socket.on('answer', (answer, viewerId) => {
  peerConnections[viewerId].setRemoteDescription(answer);
});

socket.on('ice-candidate', (candidate, senderId) => {
  peerConnections[senderId].addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on('broadcaster-left', () => {
  errorMessage.textContent = 'Broadcaster has left the room';
  videosContainer.innerHTML = ''; // Clear videos when broadcaster leaves
  peerConnections = {};
  stopBtn.disabled = true; // Disable Stop Stream button
});

socket.on('stop', () => {
  if (!isBroadcaster) {
    errorMessage.textContent = 'The broadcaster has stopped the stream';
    videosContainer.innerHTML = ''; // Clear video container
  }
});

socket.on('exit', () => {
  errorMessage.textContent = 'You have exited the room';
});

function handleMediaError(error) {
  console.error('Error accessing media devices:', error);
  switch(error.name) {
    case 'NotFoundError':
      errorMessage.textContent = 'Camera or microphone not found. Please check your device connections.';
      break;
    case 'NotAllowedError':
      errorMessage.textContent = 'Permission to use camera and microphone was denied. Please allow access in your browser settings.';
      break;
    case 'NotReadableError':
      errorMessage.textContent = 'Your camera or microphone is busy. Please make sure no other application is using it.';
      break;
    case 'OverconstrainedError':
      errorMessage.textContent = 'The requested media is not available or doesn\'t meet the constraints.';
      break;
    case 'TypeError':
      errorMessage.textContent = 'No media tracks of the requested type were found.';
      break;
    default:
      errorMessage.textContent = `An error occurred: ${error.message || 'Unknown error'}`;
  }
}

function displayError(message) {
  errorMessage.textContent = message;
}

if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  errorMessage.textContent = 'This application requires HTTPS to access media devices. Please use a secure connection.';
  createBtn.disabled = true;
  joinBtn.disabled = true;
}
