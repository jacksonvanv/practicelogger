import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Link, Routes } from 'react-router-dom';
import './App.css';

function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toLocaleTimeString('en-GB').slice(0, 5),
    notes: '',
    recording: false,
    duration: '',
    videoBlob: null,
    videoURL: '',
    startTime: null,
    showPlayback: false,
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let timer;
    if (currentSession.recording && currentSession.startTime) {
      timer = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now - currentSession.startTime) / 1000); // duration in seconds
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        setCurrentSession(prev => ({ ...prev, duration: `${minutes}m ${seconds}s` }));
      }, 1000);
    } else {
      clearInterval(timer);
    }

    return () => clearInterval(timer);
  }, [currentSession.recording, currentSession.startTime]);

  useEffect(() => {
    if (currentSession.recording) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          streamRef.current = stream;
          const video = videoRef.current;

          const mimeTypes = ['video/webm', 'video/mp4', 'video/ogg'];
          const validMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';

          const recorder = new MediaRecorder(stream, { mimeType: validMimeType });
          mediaRecorderRef.current = recorder;
          recorder.start();

          let chunks = [];
          recorder.ondataavailable = (event) => {
            chunks.push(event.data);
          };

          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: validMimeType });
            const url = URL.createObjectURL(blob);
            setCurrentSession(prev => ({
              ...prev,
              videoBlob: blob,
              videoURL: url,
              showPlayback: true,
            }));
            // Stop the stream after recording
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop());
              streamRef.current = null;
            }
          };

          // Start drawing frames on the canvas
          function drawVideoFrame() {
            if (videoRef.current) {
              const context = canvasRef.current.getContext('2d');
              context.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);
              requestAnimationFrame(drawVideoFrame);
            }
          }

          video.srcObject = stream;
          video.play();
          setTimeout(() => requestAnimationFrame(drawVideoFrame), 1000);

          setCurrentSession(prev => ({ ...prev, startTime: new Date() }));
        })
        .catch(error => {
          console.error('Error accessing media devices:', error);
          alert('Failed to access media devices. Please check permissions.');
        });
    } else if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, [currentSession.recording]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentSession(prev => ({ ...prev, [name]: value }));
  };

  const handleAddVideo = () => {
    setCurrentSession(prev => ({ ...prev, recording: !prev.recording }));
  };

  const handleSaveSession = () => {
    // Save the current session and add a new blank one
    setSessions(prevSessions => [...prevSessions, currentSession]);
    // Reset the current session to be blank
    setCurrentSession({
      title: '',
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString('en-GB').slice(0, 5),
      notes: '',
      recording: false,
      duration: '',
      videoBlob: null,
      videoURL: '',
      startTime: null,
      showPlayback: false,
    });
  };

  const fetchSessions = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/sessions');
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  return (
    <Router>
      <div className="App">
        <nav>
          <ul>
            <li>
              <Link to="/">Log Practice</Link>
            </li>
            <li>
              <Link to="/sessions">View Sessions</Link>
            </li>
          </ul>
        </nav>

        <Routes>
          <Route
            path="/"
            element={
              <>
                <h1>Practice Log</h1>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="Practice Session Title"
                    name="title"
                    value={currentSession.title}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="input-group">
                  <label>Date:</label>
                  <input
                    type="date"
                    name="date"
                    value={currentSession.date}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="input-group">
                  <label>Time:</label>
                  <input
                    type="time"
                    name="time"
                    value={currentSession.time}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="input-group">
                  <label>Notes:</label>
                  <textarea
                    placeholder="Add notes about your practice session"
                    name="notes"
                    value={currentSession.notes}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="input-group">
                  <button onClick={handleAddVideo}>
                    {currentSession.recording ? "Stop Recording" : "Start Recording"}
                  </button>
                </div>
                {currentSession.duration && (
                  <div className="input-group">
                    <label>Duration: {currentSession.duration}</label>
                  </div>
                )}
                <div className="input-group">
                  <button onClick={handleSaveSession}>
                    Save Session
                  </button>
                </div>
                <div className="input-group">
                  <canvas
                    ref={canvasRef}
                    width="640"
                    height="480"
                    style={{ display: currentSession.recording ? 'block' : 'none' }}
                  />
                </div>
                {currentSession.showPlayback && (
                  <div className="input-group">
                    <h2>Playback:</h2>
                    <video
                      controls
                      src={currentSession.videoURL}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </>
            }
          />
          <Route
            path="/sessions"
            element={
              <>
                <h1>Logged Practice Sessions</h1>
                <ul>
                  {sessions.map((session, index) => (
                    <li key={index}>
                      <h2>{session.title}</h2>
                      <p>Date: {session.date}</p>
                      <p>Time: {session.time}</p>
                      <p>Notes: {session.notes}</p>
                      <p>Duration: {session.duration}</p>
                      {session.videoURL && (
                        <video
                          controls
                          src={session.videoURL}
                          style={{ width: '100%' }}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
