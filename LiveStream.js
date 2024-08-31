import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';

const LiveStream = () => {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const socketRef = useRef(null);
    const [isStreaming, setIsStreaming] = useState(false);

    useEffect(() => {
        socketRef.current = io.connect('http://localhost:3001');

        socketRef.current.on('offer', async (offer) => {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(new RTCSessionDescription(answer));
            socketRef.current.emit('answer', answer);
        });

        socketRef.current.on('answer', (answer) => {
            peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socketRef.current.on('ice-candidate', (candidate) => {
            peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        });
    }, []);

    const startStreaming = async () => {
        peerConnectionRef.current = new RTCPeerConnection();

        peerConnectionRef.current.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current.emit('ice-candidate', event.candidate);
            }
        };

        peerConnectionRef.current.ontrack = (event) => {
            remoteVideoRef.current.srcObject = event.streams[0];
        };

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideoRef.current.srcObject = stream;

        stream.getTracks().forEach((track) => {
            peerConnectionRef.current.addTrack(track, stream);
        });

        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(new RTCSessionDescription(offer));
        socketRef.current.emit('offer', offer);

        setIsStreaming(true);
    };

    return (
        <div>
            <h1>Live Streaming</h1>
            <video ref={localVideoRef} autoPlay playsInline muted />
            <video ref={remoteVideoRef} autoPlay playsInline />
            <button onClick={startStreaming} disabled={isStreaming}>Go Live</button>
        </div>
    );
};

export default LiveStream;
