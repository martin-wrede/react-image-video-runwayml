import React, { useState } from 'react';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const generateVideo = async () => {
    setIsGenerating(true);
    setError('');
    setStatus('Starting video generation...');
    setProgress(0);

    try {
      // Step 1: Start the video generation
      const response = await fetch('/ai-claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt, 
          action: 'generate' 
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to start video generation');
      }

      const taskId = data.taskId;
      setStatus('Video generation started, processing...');

      // Step 2: Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch('/ai-claude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              taskId,
              action: 'status' 
            }),
          });

          if (!statusResponse.ok) {
            throw new Error(`HTTP error! status: ${statusResponse.status}`);
          }

          const statusData = await statusResponse.json();
          
          if (!statusData.success) {
            throw new Error(statusData.error || 'Failed to check status');
          }

          setStatus(`Status: ${statusData.status}`);
          setProgress(statusData.progress || 0);

          if (statusData.status === 'SUCCEEDED') {
            setVideoUrl(statusData.videoUrl);
            setStatus('Video generation completed!');
            setIsGenerating(false);
            clearInterval(pollInterval);
          } else if (statusData.status === 'FAILED') {
            throw new Error(statusData.failure || 'Video generation failed');
          }

        } catch (pollError) {
          console.error('Polling error:', pollError);
          setError(pollError.message);
          setIsGenerating(false);
          clearInterval(pollInterval);
        }
      }, 3000); // Poll every 3 seconds

      // Set a timeout to stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isGenerating) {
          setError('Video generation timed out');
          setIsGenerating(false);
        }
      }, 300000);

    } catch (error) {
      console.error("Error:", error);
      setError(error.message);
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Generate Video with RunwayML</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Video Prompt:
        </label>
        <input
          type="text"
          placeholder="Describe the video motion (e.g., 'camera slowly zooms in', 'gentle wind blowing')"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '10px', 
            fontSize: '16px',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}
        />
      </div>

      <button 
        onClick={generateVideo}
        disabled={isGenerating}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: isGenerating ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isGenerating ? 'not-allowed' : 'pointer'
        }}
      >
        {isGenerating ? 'Generating...' : 'Generate Video'}
      </button>

      {status && (
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
          <p>{status}</p>
          {progress > 0 && (
            <div style={{ backgroundColor: '#ddd', borderRadius: '4px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  width: `${progress}%`, 
                  height: '20px', 
                  backgroundColor: '#007bff',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: '#ffebee', 
          color: '#c62828',
          borderRadius: '4px'
        }}>
          Error: {error}
        </div>
      )}

      {videoUrl && (
        <div style={{ marginTop: '20px' }}>
          <h3>Generated Video:</h3>
          <video 
            controls 
            style={{ width: '100%', maxWidth: '500px' }}
            src={videoUrl}
          >
            Your browser does not support the video tag.
          </video>
          <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
            <a href={videoUrl} target="_blank" rel="noopener noreferrer">
              Open video in new tab
            </a>
          </p>
        </div>
      )}

      <div style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
        <p><strong>Source Image:</strong> https://martin-wrede.github.io/targetx-website/Home-03.jpg</p>
        <p><strong>Model:</strong> gen3a_turbo</p>
        <p><strong>Duration:</strong> 4 seconds</p>
        <p><strong>Resolution:</strong> 1280x720</p>
      </div>
    </div>
  );
}