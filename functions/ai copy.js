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

  try {
    const contentType = request.headers.get('content-type') || '';

    // --- A. HANDLE IMAGE UPLOAD & VIDEO GENERATION ---
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const promptText = formData.get('promptText');
      const imageFile = formData.get('promptImage');

      if (!promptText || !imageFile) {
        throw new Error('FormData is missing "promptText" or "promptImage".');
      }

      const key = `uploads/${Date.now()}-${imageFile.name}`;
      await env.IMAGE_BUCKET.put(key, imageFile.stream(), {
        httpMetadata: { contentType: imageFile.type },
      });

      const imageUrlForRunway = `${env.IMAGE_BUCKET.publicUrl}/${key}`;
      const model = 'gen3a_turbo';
      const duration = 5;
      const ratio = '1280:768';

      const headers = new Headers();
      headers.append('Authorization', `Bearer ${env.RUNWAYML_API_KEY}`);
      headers.append('Content-Type', 'application/json');
      headers.append('X-Runway-Version', '2024-11-06');

      const payload = {
        model,
        promptText,
        promptImage: imageUrlForRunway,
        duration,
        ratio
      };

      console.log('Sent headers:', [...headers.entries()]);
      console.log('Payload to Runway:', payload);

      const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

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

      const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
          'X-Runway-Version': '2024-11-06'
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
        videoUrl: data.output?.[0] || null,
        failure: data.failure || null,
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // --- C. HANDLE INVALID REQUEST ---
    else {
      throw new Error(`Invalid Content-Type. Expected 'multipart/form-data' or 'application/json'.`);
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
