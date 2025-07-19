
import React, { useState } from 'react';


export default function App() {
  const [prompt, setPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validierung des Dateityps
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setError('Bitte wählen Sie ein gültiges Bildformat (JPEG, PNG, GIF, WebP)');
        return;
      }

      // Validierung der Dateigröße (z.B. max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        setError('Die Datei ist zu groß. Maximum 10MB erlaubt.');
        return;
      }

      setSelectedFile(file);
      setError('');
      
      // Erstelle Preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    // Reset file input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.value = '';
    }
  };

// --- Replace the existing generateVideo function in App.jsx with this one ---
const generateVideo = async () => {
    if (!selectedFile || !prompt.trim()) {
      setError('Please select an image and enter a prompt.');
      return;
    }

    setIsGenerating(true);
    // ... reset states ...

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('prompt', prompt);

      // Call the worker with FormData
      const response = await fetch('/ai', {
        method: 'POST',
        body: formData, // Sending the file and prompt
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      // The rest of your polling logic can stay exactly the same!
      const taskId = data.taskId;
      setStatus('Video generation started, processing...');
      // ... your setInterval polling logic ...

    } catch (error) {
      setError(error.message);
      setIsGenerating(false);
    }
};

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Generate Video with RunwayML  7</h2>
      
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

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Source Image:
        </label>
        <input
          id="fileInput"
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ 
            width: '100%', 
            padding: '10px', 
            fontSize: '16px',
            borderRadius: '4px',
            border: '1px solid #ddd',
            backgroundColor: '#f9f9f9'
          }}
        />
        <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          Unterstützte Formate: JPEG, PNG, GIF, WebP (max. 10MB)
        </p>
      </div>

      {previewUrl && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Bild Vorschau:
          </label>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img 
              src={previewUrl} 
              alt="Preview" 
              style={{ 
                maxWidth: '300px', 
                maxHeight: '200px', 
                borderRadius: '4px',
                border: '1px solid #ddd'
              }} 
            />
            <button
              onClick={removeFile}
              style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                backgroundColor: 'rgba(255, 0, 0, 0.7)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '25px',
                height: '25px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Datei: {selectedFile?.name} ({(selectedFile?.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        </div>
      )}

      <button 
        onClick={generateVideo}
        disabled={isGenerating || !selectedFile || !prompt.trim()}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: (isGenerating || !selectedFile || !prompt.trim()) ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: (isGenerating || !selectedFile || !prompt.trim()) ? 'not-allowed' : 'pointer'
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
        <p><strong>Model:</strong> gen3a_turbo</p>
        <p><strong>Duration:</strong> 4 seconds</p>
        <p><strong>Resolution:</strong> 1280x720</p>
      </div>
    </div>
  );
}