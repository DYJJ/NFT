// import { ipfsClient } from "~~/utils/simpleNFT/ipfs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = JSON.stringify(body);
    
    const pintaAPIKEY = process.env.PINATA_API_KEY;
    const pintaAPISECRET = process.env.PINATA_API_SECRET;

    if (!pintaAPIKEY || !pintaAPISECRET) {
      console.error('Pinata API credentials not configured');
      return Response.json(
        { error: "IPFS configuration missing. Please check environment variables." }, 
        { status: 500 }
      );
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': pintaAPIKEY,
        'pinata_secret_api_key': pintaAPISECRET,
      },
      body: data,
    });

    if (!response.ok) {
      const errorResponse = await response.json();
      console.error('Pinata API error:', errorResponse);
      return Response.json({ 
        error: "Failed to pin content to IPFS", 
        details: errorResponse 
      }, { status: response.status });
    }

    const result = await response.json();
    console.log('Successfully pinned content to IPFS:', result.IpfsHash);
    return Response.json(result);
    
  } catch (error) {
    console.error("IPFS upload error:", error);
    return Response.json({ 
      error: "Internal server error during IPFS upload",
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}