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

  console.log('Payload to Runway:', {
    model,
    promptText,
    promptImage: imageUrlForRunway,
    duration,
    ratio
  });

  const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': '2024-11-06'
    },
    body: JSON.stringify({
      model,
      promptText,
      promptImage: imageUrlForRunway,
      duration,
      ratio
    })
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
