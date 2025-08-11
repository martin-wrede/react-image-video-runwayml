// --- START OF FILE functions/ai.js (Final Diagnostic Version 3.0) ---

export async function onRequest(context) {
  // --- THIS IS THE DIAGNOSTIC LOG ---
  console.log("--- RUNNING AI.JS VERSION 3.0 (Header Case Fix) ---"); 

  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Runway-Version',
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Ensure environment variables are set
  if (!env.RUNWAYML_API_KEY || !env.IMAGE_BUCKET) {
    const errorMsg = 'SERVER MISCONFIGURATION: RUNWAYML_API_KEY or IMAGE_BUCKET binding is missing.';
    console.error(errorMsg);
    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    // --- A. HANDLE IMAGE UPLOAD & VIDEO GENERATION ---
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const prompt = formData.get('prompt');
      const imageFile = formData.get('image');

      if (!prompt || !imageFile) {
        throw new Error('FormData is missing the required "prompt" or "image" field.');
      }

      const key = `uploads/${Date.now()}-${imageFile.name}`;
      await env.IMAGE_BUCKET.put(key, imageFile.stream(), {
        httpMetadata: { contentType: imageFile.type },
      });
      const imageUrlForRunway = `${env.IMAGE_BUCKET.publicUrl}/${key}`;
      
      const payload = {
        model: 'gen3a_turbo',
        prompt: prompt,
        init_image_url: imageUrlForRunway,
        duration_seconds: 4,
        watermark: false,
      };

      const headers = {
        'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-05-15',
      };

      // Log the exact headers we are about to send
      console.log("Sending headers to Runway:", JSON.stringify(headers));

      const response = await fetch('https://api.dev.runwayml.com/v2/image-to-video', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('RunwayML API Error:', response.status, response.statusText, data);
        throw new Error(`Runway API Error: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({ success: true, taskId: data.id, status: data.status }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // --- B. HANDLE TASK STATUS CHECK ---
    else if (contentType.includes('application/json')) {
      const body = await request.json();
      const { taskId, action } = body;

      if (action !== 'status' || !taskId) {
        throw new Error('Invalid action or missing taskId for JSON request.');
      }

      const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
          'X-Runway-Version': '2024-05-15',
        },
      });

      const data = await statusResponse.json();
      if (!statusResponse.ok) {
        throw new Error(`Failed to check task status. API Response: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({
        success: true,
        status: data.status,
        progress: data.progress / 100 || 0,
        videoUrl: data.output?.url || null,
        failure: data.failure || null,
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    else {
      throw new Error(`Invalid Content-Type.`);
    }
  } catch (error) {
    console.error('Error in Cloudflare Worker:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}