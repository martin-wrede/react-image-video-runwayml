// --- FINAL CONSOLIDATED VERSION ---
// This version combines all our successful debugging steps.
// 19.18
export async function onRequest(context) {
  // --- This log confirms this final version is running ---
  console.log("--- RUNNING FINAL CONSOLIDATED AI.JS VERSION ---"); 

  const { request, env } = context;

  // Handles preflight requests for CORS
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

  // This is the safety check for your Cloudflare settings.
  // If this fails, the error message will appear in your browser's console.
  if (!env.RUNWAYML_API_KEY || !env.R2_PUBLIC_URL || !env.IMAGE_BUCKET) {
    const errorMsg = 'CRITICAL FIX REQUIRED: Your Cloudflare project settings are incomplete. Please ensure RUNWAYML_API_KEY and R2_PUBLIC_URL environment variables are set, AND the IMAGE_BUCKET R2 binding is active.';
    console.error(errorMsg);
    return new Response(JSON.stringify({ success: false, error: errorMsg }), { status: 500 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    // --- Block A: Starts the video generation ---
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const prompt = formData.get('prompt');
      const imageFile = formData.get('image');

      if (!prompt || !imageFile) throw new Error('Missing prompt or image file from the request.');

      // 1. Upload the image to R2
      const key = `uploads/${Date.now()}-${imageFile.name}`;
      await env.IMAGE_BUCKET.put(key, imageFile.stream(), {
        httpMetadata: { contentType: imageFile.type },
      });
      
      // 2. Build the image URL using the reliable bypass method
      const imageUrlForRunway = `${env.R2_PUBLIC_URL}/${key}`;
      console.log("Constructed image URL for Runway:", imageUrlForRunway);

      // 3. Prepare the API request for the stable Gen-2 model
      const gen2ModelId = 'a711833c-2195-4760-a292-421712a23059';
      const payload = {
        modelId: gen2ModelId,
        input: { prompt, image: imageUrlForRunway },
      };
      
      // 4. Send the request to the correct 'dev' server with the required header
      const response = await fetch('https://api.dev.runwayml.com/v1/inference-jobs', {
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

      return new Response(JSON.stringify({ success: true, taskId: data.id }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    
    // --- Block B: Checks the status of the video generation ---
    else if (contentType.includes('application/json')) {
      const body = await request.json();
      const { taskId, action } = body;

      if (action !== 'status' || !taskId) throw new Error('Invalid status check request.');
      
      const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
          'X-Runway-Version': '2024-05-15',
        },
      });

      const data = await statusResponse.json();
      if (!statusResponse.ok) throw new Error(`Status check failed: ${JSON.stringify(data)}`);

      return new Response(JSON.stringify({
        success: true,
        status: data.status,
        progress: data.progress_normalized || 0, // Gen-2 uses progress_normalized
        videoUrl: data.output?.video_url || null, // Gen-2 uses output.video_url
        failure: data.failure || null,
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    } 
    
    else {
      throw new Error(`Invalid request content-type.`);
    }

  } catch (error) {
    console.error('Error inside Cloudflare Function:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}