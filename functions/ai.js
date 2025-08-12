// 18.45 postman test
// --- START OF FILE functions/ai.js (Final Version 12.0 - Postman Replication) ---

export async function onRequest(context) {
  // --- This log confirms we are running the definitive Postman version ---
  console.log("--- RUNNING AI.JS VERSION 12.0 (Postman Replication) ---"); 

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
      // Read the 'prompt' and 'image' sent by the frontend
      const prompt = formData.get('prompt');
      const imageFile = formData.get('image');

      if (!prompt || !imageFile) throw new Error('Missing prompt or image.');

      const key = `uploads/${Date.now()}-${imageFile.name}`;
      await env.IMAGE_BUCKET.put(key, imageFile.stream(), {
        httpMetadata: { contentType: imageFile.type },
      });
      const imageUrlForRunway = `${env.R2_PUBLIC_URL}/${key}`;
      
      // --- THE POSTMAN FIX: Build the payload with the EXACT keys from your test ---
      const payload = {
        model: "gen3a_turbo",
        promptText: prompt, // Use 'promptText' key
        promptImage: imageUrlForRunway, // Use 'promptImage' key
        duration: 5,
        ratio: "1280:768"
      };

      console.log("Sending payload that replicates Postman:", JSON.stringify(payload));
      
      // --- THE POSTMAN FIX: Use the v1 endpoint that accepts this payload ---
      const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
          'Content-Type': 'application/json',
          // --- THE POSTMAN FIX: Use the EXACT version date from your test ---
          'X-Runway-Version': '2024-11-06', 
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(`Runway API Error: ${JSON.stringify(data)}`);

      return new Response(JSON.stringify({ success: true, taskId: data.id, status: data.status }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    // ... status check logic must also be consistent
    else if (contentType.includes('application/json')) {
      const body = await request.json();
      const { taskId, action } = body;
      if (action !== 'status' || !taskId) throw new Error('Invalid JSON request');
      const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
          'X-Runway-Version': '2024-11-06',
        },
      });
      const data = await statusResponse.json();
      if (!statusResponse.ok) throw new Error(`Status check failed: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify({
        success: true, status: data.status, progress: data.progress, // This endpoint gives 'progress'
        videoUrl: data.output?.[0] || null, // This endpoint gives output as an array
        failure: data.failure || null,
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    } else {
      throw new Error(`Invalid Content-Type.`);
    }
  } catch (error) {
    console.error('Error in Cloudflare Worker:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}