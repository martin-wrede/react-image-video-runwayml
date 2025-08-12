// --- START OF FILE functions/ai.js (Final Clean Project Version 9.0) ---
// 17.33
export async function onRequest(context) {
  // --- This log confirms this new project is running the correct version ---
  console.log("--- RUNNING AI.JS VERSION 9.0 (Clean Project Hardcode) ---"); 

  const { request, env } = context;

  // --- We are HARDCODING the URL to bypass any R2 public URL issues ---
  const R2_PUBLIC_URL = "https://pub-2e08632872a645f89f91aad5f2904c70.r2.dev";

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Final safety check. We only need the API key and the bucket itself now.
  if (!env.RUNWAYML_API_KEY || !env.IMAGE_BUCKET) {
    const errorMsg = 'SERVER MISCONFIGURATION: The RUNWAYML_API_KEY or the IMAGE_BUCKET binding is missing from the new project settings.';
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
      await env.IMAGE_BUCKET.put(key, imageFile.stream(), { httpMetadata: { contentType: imageFile.type } });
      
      const imageUrlForRunway = `${R2_PUBLIC_URL}/${key}`;
      console.log("Constructed hardcoded image URL:", imageUrlForRunway);

      const payload = { modelId: 'a711833c-2195-4760-a292-421712a23059', input: { prompt, image: imageUrlForRunway } };
      
      const response = await fetch('https://api.dev.runwayml.com/v1/inference-jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`, 'Content-Type': 'application/json',
          'X-Runway-Version': '2024-05-15', 
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(`Runway API Error: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify({ success: true, taskId: data.id }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
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
        success: true, status: data.status, progress: data.progress_normalized || 0,
        videoUrl: data.output?.video_url || null, failure: data.failure || null,
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    } else {
      throw new Error(`Invalid Content-Type.`);
    }
  } catch (error) {
    console.error('Error in Cloudflare Worker:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}