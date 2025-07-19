// functions/ai-claude.js - CORRECTED AND WORKING VERSION
// Forcing a redeployment on July 14, 2025 to apply latest bindings.

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

  // This is the main try...catch block for the entire worker
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

       console.log('prompt:', prompt);
        console.log('imageFile:', imageFile?.name, imageFile?.type);
        console.log('R2 key:', key);
        console.log('imageUrlForRunway:', imageUrlForRunway);

        // Define values
        const model = 'gen4_turbo';
        const ratio = '1280:720';
        const duration = 5;

        console.log('Payload to Runway:', {
          model,
          promptText: prompt,
          promptImage: imageUrlForRunway,
          ratio,
          duration
        });

      // 4. Call the RunwayML API with the new public image URL
      const response = await fetch('https://api.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,          
          'X-Runway-API-Version': '2024-05-15', // 'X-Runway-Version': '2024-03-01',  //    'X-Runway-Version': '2024-09-13',  
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
        model,
        promptText: prompt,
        promptImage: imageUrlForRunway,
        ratio,
        duration,
        }),
      });
     
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
      
      // Using your working status check logic
      const statusResponse = await fetch(`https://api.runwayml.com/v1/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,// 
          'X-Runway-API-Version': '2024-05-15',  // 'X-Runway-Version': '2024-11-06',
        },
      });

      const data = await statusResponse.json();
      
      if (!statusResponse.ok) {
        // We will just log the error and let the poller try again
        console.error(`Status check failed:`, statusResponse.status, data);
        // Still return a success=false so the frontend knows what happened
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
      throw new Error(`Invalid request Content-Type. Expected 'multipart/form-data' or 'application/json'.`);
    }

  } catch (error) {
    // This is the single catch block that handles any error from the logic above
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