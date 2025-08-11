// --- START OF FILE functions/ai.js (Final Working Version 4.0) ---

export async function onRequest(context) {
  // --- This log confirms this new version is running ---
  console.log("--- RUNNING AI.JS VERSION 4.0 (Gen-2 on Dev Host) ---"); 

  const { request, env } = context;

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

  if (!env.RUNWAYML_API_KEY || !env.IMAGE_BUCKET) {
    return new Response(JSON.stringify({ success: false, error: "Server misconfiguration" }), { status: 500 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    // --- A. HANDLE IMAGE UPLOAD & VIDEO GENERATION ---
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const prompt = formData.get('prompt');
      const imageFile = formData.get('image');

      if (!prompt || !imageFile) {
        throw new Error('Missing prompt or image.');
      }

      const key = `uploads/${Date.now()}-${imageFile.name}`;
      await env.IMAGE_BUCKET.put(key, imageFile.stream(), {
        httpMetadata: { contentType: imageFile.type },
      });
      const imageUrlForRunway = `${env.IMAGE_BUCKET.publicUrl}/${key}`;
      
      // --- CHANGE: Point to the stable Gen-2 model ID ---
      const gen2ModelId = 'a711833c-2195-4760-a292-421712a23059';

      const payload = {
        modelId: gen2ModelId,
        input: {
          prompt: prompt,
          image: imageUrlForRunway,
        },
      };

      console.log("Sending payload to Gen-2:", JSON.stringify(payload));
      
      // --- CHANGE: Use the correct v1 endpoint on the dev host ---
      const response = await fetch('https://api.dev.runwayml.com/v1/inference-jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
          'Content-Type': 'application/json',
          // --- CHANGE: The v1 endpoint does NOT use the X-Runway-Version header ---
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('RunwayML API Error:', response.status, data);
        throw new Error(`Runway API Error: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({ success: true, taskId: data.id }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // --- B. HANDLE TASK STATUS CHECK ---
    else if (contentType.includes('application/json')) {
      const body = await request.json();
      const { taskId, action } = body;

      if (action !== 'status' || !taskId) throw new Error('Invalid JSON request');
      
      const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
          // --- CHANGE: Also removed header from here for consistency ---
        },
      });

      const data = await statusResponse.json();
      if (!statusResponse.ok) throw new Error(`Status check failed: ${JSON.stringify(data)}`);

      return new Response(JSON.stringify({
        success: true,
        status: data.status,
        progress: data.progress_normalized || 0, // Gen-2 uses progress_normalized (0-1)
        videoUrl: data.output?.video_url || null, // Gen-2 uses output.video_url
        failure: data.failure || null,
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } else {
      throw new Error(`Invalid Content-Type.`);
    }

  } catch (error) {
    console.error('Error in Cloudflare Worker:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}