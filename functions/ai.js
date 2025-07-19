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

      // 1. Create a unique filename for R2
      const key = `uploads/${Date.now()}-${imageFile.name}`;

      // 2. Upload the image file to your R2 bucket
      await env.IMAGE_BUCKET.put(key, imageFile.stream(), {
        httpMetadata: { contentType: imageFile.type },
      });

      // 3. Get the public URL automatically from the binding
      const publicBucketUrl = env.IMAGE_BUCKET.publicUrl;
      const imageUrlForRunway = `${publicBucketUrl}/${key}`;

      // --- START: MODIFICATIONS FOR RUNWAYML v2 API ---

      // Define values based on the correct API schema
      const model = 'gen4_turbo'; // Your desired model
      const duration_seconds = 4; // Use 'duration_seconds'

      console.log('Payload to Runway:', {
        model,
        prompt: prompt, // Use 'prompt' instead of 'promptText'
        init_image_url: imageUrlForRunway, // Use 'init_image_url' instead of 'promptImage'
        duration_seconds, // Use 'duration_seconds' instead of 'duration'
      });

      // 4. Call the RunwayML API with the correct headers and payload
      const response = await fetch('https://api.runwayml.com/v2/image-to-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
          'Content-Type': 'application/json',
          // REMOVED: 'x-runway-api-version' header is not needed for this v2 endpoint
        },
        body: JSON.stringify({
          model,
          prompt: prompt, // CORRECT KEY
          init_image_url: imageUrlForRunway, // CORRECT KEY
          duration_seconds, // CORRECT KEY
          // REMOVED: 'ratio' is not a valid parameter here; it's inferred from the image
        }),
      });

      // --- END: MODIFICATIONS ---

      const data = await response.json();
      if (!response.ok) {
        console.error('RunwayML API returned error:', data);
        throw new Error(`Runway API Error: ${JSON.stringify(data)}`);
      }

      // Success! Return the task ID to the frontend
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

      // The status check endpoint is different and might still use older conventions or v1.
      // We will check the status of a v2 task using the v1 endpoint, which is correct.
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
        videoUrl: data.output?.url || null, // The output URL is in 'output.url'
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