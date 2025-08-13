// --- Production-Ready Code for a NEW API Key ---

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!env.RUNWAYML_API_KEY || !env.R2_PUBLIC_URL || !env.IMAGE_BUCKET) {
    const errorMsg = 'CRITICAL FIX REQUIRED: Check Cloudflare project settings.';
    return new Response(JSON.stringify({ success: false, error: errorMsg }), { status: 500 });
  }
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const prompt = formData.get('prompt');
      const imageFile = formData.get('image');
      const key = `uploads/${Date.now()}-${imageFile.name}`;
      await env.IMAGE_BUCKET.put(key, imageFile.stream(), { httpMetadata: { contentType: imageFile.type } });
      const imageUrlForRunway = `${env.R2_PUBLIC_URL}/${key}`;
      const payload = { modelId: 'a711833c-2195-4760-a292-421712a23059', input: { prompt, image: imageUrlForRunway } };
      
      // Using the standard PRODUCTION server
      const response = await fetch('https://api.runwayml.com/v1/inference-jobs', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(`Runway API Error: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify({ success: true, taskId: data.id }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    else if (contentType.includes('application/json')) {
      const { taskId, action } = await request.json();
      const statusResponse = await fetch(`https://api.runwayml.com/v1/tasks/${taskId}`, { headers: { 'Authorization': `Bearer ${env.RUNWAYML_API_KEY}` } });
      const data = await statusResponse.json();
      if (!statusResponse.ok) throw new Error(`Status check failed: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify({
        success: true, status: data.status, progress: data.progress_normalized || 0,
        videoUrl: data.output?.video_url || null, failure: data.failure || null,
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    else { throw new Error(`Invalid request content-type.`); }
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}