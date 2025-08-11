// --- START OF FILE functions/ai.js (Final Corrected Version for Dev API) ---

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // --- Ensure environment variables are set ---
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
      // --- FIX: Read the correct keys sent from the frontend ---
      const prompt = formData.get('prompt');
      const imageFile = formData.get('image');

      if (!prompt || !imageFile) {
        throw new Error('FormData is missing the required "prompt" or "image" field.');
      }

      // 1. Upload image to R2
      const key = `uploads/${Date.now()}-${imageFile.name}`;
      await env.IMAGE_BUCKET.put(key, imageFile.stream(), {
        httpMetadata: { contentType: imageFile.type },
      });
      const imageUrlForRunway = `${env.IMAGE_BUCKET.publicUrl}/${key}`;
      
      const payload = {
        model: 'gen3a_turbo',
        // --- FIX: Use the correct payload keys for the v2 API ---
        prompt: prompt,
        init_image_url: imageUrlForRunway,
        duration_seconds: 4,
        watermark: false,
      };

      // --- FIX: Use the correct endpoint and API version header ---
      const response = await fetch('https://api.dev.runwayml.com/v2/image-to-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
          'Content-Type': 'application/json',
          'x-runway-api-version': '2024-05-15', // Use the documented version for v2
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('RunwayML API Error:', response.status, response.statusText, data);
        throw new Error(`Runway API Error: ${JSON.stringify(data)}`);
      }

      // Success! Return the task ID
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

      // --- FIX: Use the correct hostname for status checks as well ---
      const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
          // Note: version header is not typically needed for v1 status checks
        },
      });

      const data = await statusResponse.json();

      if (!statusResponse.ok) {
        throw new Error(`Failed to check task status. API Response: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({
        success: true,
        status: data.status,
        // The v2 task status from v1 endpoint gives 'progress' from 0-100
        progress: data.progress / 100 || 0,
        // The v2 task output URL is in 'output.url'
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