// --- FINAL ATTEMPT (v8.0): Gen-3 on the Dev Host ---
// This is the last logical combination based on all error messages.
// 17.45
export async function onRequest(context) {
  console.log("--- RUNNING FINAL ATTEMPT (v8.0): Gen-3 on Dev Host ---"); 

  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!env.RUNWAYML_API_KEY || !env.R2_PUBLIC_URL || !env.IMAGE_BUCKET) {
    const errorMsg = 'CRITICAL FIX REQUIRED: Your Cloudflare project settings are incomplete.';
    return new Response(JSON.stringify({ success: false, error: errorMsg }), { status: 500 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    // --- Block A: Starts Gen-3 video generation ---
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const prompt = formData.get('prompt');
      const imageFile = formData.get('image');

      if (!prompt || !imageFile) throw new Error('Missing prompt or image.');

      const key = `uploads/${Date.now()}-${imageFile.name}`;
      await env.IMAGE_BUCKET.put(key, imageFile.stream(), { httpMetadata: { contentType: imageFile.type } });
      const imageUrlForRunway = `${env.R2_PUBLIC_URL}/${key}`;
      
      // --- THE CHANGE: Using the Gen-3 payload structure ---
      const payload = {
        model: 'gen3a_turbo',
        prompt: prompt,
        init_image_url: imageUrlForRunway,
        duration_seconds: 4,
        watermark: false,
      };

      // --- THE CHANGE: Using the v2 endpoint for Gen-3 ---
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
      if (!response.ok) throw new Error(`Runway API Error (Gen-3 Attempt): ${JSON.stringify(data)}`);

      return new Response(JSON.stringify({ success: true, taskId: data.id }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    
    // --- Block B: Checks the status (this part remains the same) ---
    else if (contentType.includes('application/json')) {
      const body = await request.json();
      const { taskId, action } = body;
      if (action !== 'status' || !taskId) throw new Error('Invalid status check.');
      
      const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`, 'X-Runway-Version': '2024-05-15' },
      });

      const data = await statusResponse.json();
      if (!statusResponse.ok) throw new Error(`Status check failed: ${JSON.stringify(data)}`);

      // The status response for a Gen-3 task has a different structure
      return new Response(JSON.stringify({
        success: true, status: data.status, 
        progress: data.progress / 100 || 0, // Progress is 0-100
        videoUrl: data.output?.url || null, // URL is in output.url
        failure: data.failure || null,
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    } 
    
    else { throw new Error(`Invalid request content-type.`); }

  } catch (error) {
    console.error('Error inside Cloudflare Function:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}