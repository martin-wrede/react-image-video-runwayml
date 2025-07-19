// functions/ai.js - CORRECTED AND WORKING VERSION

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS Preflight request
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

      const publicBucketUrl = env.IMAGE_BUCKET.publicUrl;
      const imageUrlForRunway = `${publicBucketUrl}/${key}`;
      
      // --- START: MODIFICATIONS FOR GEN-3 API ---

      // 1. Correct the model name to a valid Gen-3 model
      const model = 'gen3a_turbo'; //  <--- FIX #1: Changed from gen4_turbo
      const duration_seconds = 4;

      console.log('Payload to Runway:', {
        model,
        prompt: prompt,
        init_image_url: imageUrlForRunway,
        duration_seconds,
      });

      // 2. Call the RunwayML API with the correct header and payload
      const response = await fetch('https://api.runwayml.com/v2/image-to-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
          'Content-Type': 'application/json',
          'x-runway-api-version': '2024-05-15', // <--- FIX #2: Re-added this required header
        },
        body: JSON.stringify({
          model,
          prompt,
          init_image_url: imageUrlForRunway,
          duration_seconds,
        }),
      });

      // --- END: MODIFICATIONS ---

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

      const statusResponse = await fetch(`https://api.runwayml.com/v1/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
        },
      });

      const data = await statusResponse.json();

      if (!statusResponse.ok) {
        console.error(`Status check failed:`, statusResponse.status, data);
        throw new Error(`Failed to check task status. API Response: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({
        success: true,
        status: data.status,
        progress: data.progress,
        videoUrl: data.output?.url || null,
        failure: data.failure || null,
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    // --- C. HANDLE INVALID REQUEST ---
    else {
      throw new Error(`Invalid request Content-Type. Expected 'multipart/form-data' or 'application/json'.`);
    }

  } catch (error) {
    console.error('Error in Cloudflare Worker:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}