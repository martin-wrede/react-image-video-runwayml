// --- START OF FILE functions/ai.js (Final Corrected Version 10.0) ---
// 17.55
export async function onRequest(context) {
  // --- This log confirms the final, correct API version is running ---
  console.log("--- RUNNING AI.JS VERSION 10.0 (Gen-3 on Dev Host) ---"); 

  const { request, env } = context;

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

  // Use the environment variable, which we know is now configured correctly.
  if (!env.RUNWAYML_API_KEY || !env.IMAGE_BUCKET || !env.R2_PUBLIC_URL) {
    const errorMsg = 'SERVER MISCONFIGURATION: One or more required environment variables are missing.';
    console.error(errorMsg);
    return new Response(JSON.stringify({ success: false, error: errorMsg }), { status: 500 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const prompt = formData.get('prompt');
      const imageFile = formData.get('image');

      if (!prompt || !imageFile) throw new Error('Missing prompt or image.');

      const key = `uploads/${Date.now()}-${imageFile.name}`;
      await env.IMAGE_BUCKET.put(key, imageFile.stream(), {
        httpMetadata: { contentType: imageFile.type },
      });
      
      const imageUrlForRunway = `${env.R2_PUBLIC_URL}/${key}`;
      
      // --- THE FINAL FIX: Using the correct v2/Gen-3 payload schema ---
      const payload = {
        model: 'gen3a_turbo',
        prompt: prompt,
        init_image_url: imageUrlForRunway,
        duration_seconds: 4,
        watermark: false,
      };

      console.log("Sending payload to Gen-3 v2 endpoint:", JSON.stringify(payload));
      
      // --- THE FINAL FIX: Using the correct v2/Gen-3 endpoint ---
      const response = await fetch('https://api.dev.runwayml.com/v2/image-to-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Runway-Version': '2024-05-15', 
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(`Runway API Error: ${JSON.stringify(data)}`);

      return new Response(JSON.stringify({ success: true, taskId: data.id, status: data.status }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    // ... the status check logic remains the same and is correct
    else if (contentType.includes('application/json')) {
      const body = await request.json();
      const { taskId, action } = body;
      if (action !== 'status' || !taskId) throw new Error('Invalid JSON request');
      const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`, 'X-Runway-Version': '2024-05-15' },
      });
      const data = await statusResponse.json();
      if (!statusResponse.ok) throw new Error(`Status check failed: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify({
        success: true, status: data.status, progress: data.progress / 100 || 0, // v2 tasks give progress 0-100
        videoUrl: data.output?.url || null, failure: data.failure || null, // v2 tasks use output.url
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    } else {
      throw new Error(`Invalid Content-Type.`);
    }
  } catch (error) {
    console.error('Error in Cloudflare Worker:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}