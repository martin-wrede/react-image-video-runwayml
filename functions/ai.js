// --- START OF FILE functions/ai.js (Final Version 13.0 - The Literal Postman Test) ---
// 19.04
export async function onRequest(context) {
  // This log confirms we are running the definitive test.
  console.log("--- RUNNING AI.JS VERSION 13.0 (The Literal Postman Test) ---"); 

  const { request, env } = context;

  // This function will now IGNORE the incoming browser request and send a hardcoded one.
  
  if (!env.RUNWAYML_API_KEY) {
    const errorMsg = 'SERVER MISCONFIGURATION: The RUNWAYML_API_KEY is missing.';
    console.error(errorMsg);
    return new Response(JSON.stringify({ success: false, error: errorMsg }), { status: 500 });
  }

  try {
    // --- STEP 1: Define the EXACT data from your successful Postman test ---
    const postmanHeaders = {
      'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': '2024-11-06',
    };

    const postmanBody = {
      model: "gen3a_turbo",
      promptText: "A cat dancing in space",
      promptImage: "https://martin-wrede.github.io/targetx-website/Home-03.jpg",
      duration: 5,
      ratio: "1280:768"
    };

    // --- STEP 2: We will try the most likely endpoint first ---
    const endpointUrl = 'https://api.dev.runwayml.com/v1/image_to_video';
    
    console.log("ATTEMPTING LITERAL POSTMAN REQUEST TO:", endpointUrl);
    console.log("HEADERS:", JSON.stringify(postmanHeaders));
    console.log("BODY:", JSON.stringify(postmanBody));

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: postmanHeaders,
      body: JSON.stringify(postmanBody),
    });

    const data = await response.json();

    if (!response.ok) {
      // If this fails, the log will tell us everything.
      console.error("LITERAL TEST FAILED. Status:", response.status);
      throw new Error(`Runway API Error (Literal Test): ${JSON.stringify(data)}`);
    }

    // --- STEP 3: If we reach here, the test was a SUCCESS! ---
    console.log("LITERAL TEST SUCCEEDED!", data);

    // We can't poll for status since this isn't a real request from the UI,
    // so we will return the successful data directly.
    return new Response(JSON.stringify({ 
        success: true, 
        message: "LITERAL POSTMAN TEST SUCCEEDED! The endpoint and headers are correct.",
        runwayResponse: data 
    }), { 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
    });

  } catch (error) {
    console.error('Error in Cloudflare Worker:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}