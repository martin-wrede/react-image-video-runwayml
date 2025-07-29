
export async function onRequest(context) {
  const { request, env } = context;
  
  // Handle CORS
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
    const body = await request.json();
    const { prompt, action, taskId } = body;

    if (action === 'generate') {
      // Updated request configurations with correct API structure
      const requestConfigs = [
        {
          name: 'Gen3 Alpha Turbo',
          body: {
            model: 'gen3a_turbo',
            promptText: prompt || 'A cinematic shot with smooth camera movement',
            promptImage: 'https://martin-wrede.github.io/targetx-website/Home-03.jpg',
            seed: Math.floor(Math.random() * 4294967295),
            watermark: false,
            duration: 5,
            ratio: '1280:768'
          }
        }
      ];

      let lastError = null;
      
      for (const config of requestConfigs) {
        try {
          console.log(`Trying ${config.name} with body:`, JSON.stringify(config.body, null, 2));
          
          // Try production API first, then dev API // 
          // Try production API first, then dev API // 
          const apiUrls = [ 
            'https://api.dev.runwayml.com/v1/image_to_video',
          ];
          
          for (const apiUrl of apiUrls) {
            try {
              const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
                  'X-Runway-Version': '2024-11-06',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(config.body),
              });

              const data = await response.json();
              console.log(`${config.name} response from ${apiUrl}:`, response.status, data);
              
              if (response.ok) {
                // Success! Return the result
                return new Response(JSON.stringify({
                  success: true,
                  taskId: data.id,
                  status: data.status,
                  config: config.name,
                  apiUrl: apiUrl
                }), {
                  headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                  }
                });
              } else {
                lastError = { 
                  config: config.name, 
                  apiUrl: apiUrl,
                  status: response.status, 
                  data: data,
                  headers: Object.fromEntries(response.headers.entries())
                };
              }
            } catch (fetchError) {
              lastError = { 
                config: config.name, 
                apiUrl: apiUrl,
                error: fetchError.message 
              };
              console.error(`${config.name} failed for ${apiUrl}:`, fetchError);
            }
          }
        } catch (error) {
          lastError = { config: config.name, error: error.message };
          console.error(`${config.name} failed:`, error);
        }
      }

      // If we get here, all configs failed
      throw new Error(`All configurations failed. Last error: ${JSON.stringify(lastError, null, 2)}`);

    } else if (action === 'status') {
      // Check task status - try both API endpoints
      const apiUrls = [

        'https://api.dev.runwayml.com/v1/tasks'
      ];
      
      for (const baseUrl of apiUrls) {
        try {
          const response = await fetch(`${baseUrl}/${taskId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
              'X-Runway-Version': '2024-11-06',
            },
          });

          const data = await response.json();
          
          if (response.ok) {
            return new Response(JSON.stringify({
              success: true,
              status: data.status,
              progress: data.progress,
              videoUrl: data.output?.[0] || null,
              failure: data.failure || null,
              apiUrl: baseUrl
            }), {
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              }
            });
          } else {
            console.error(`Status check failed for ${baseUrl}:`, response.status, data);
          }
        } catch (error) {
          console.error(`Status check error for ${baseUrl}:`, error);
        }
      }
      
      throw new Error(`Failed to check task status for task ID: ${taskId}`);
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (error) {
    console.error('Error:', error);
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
