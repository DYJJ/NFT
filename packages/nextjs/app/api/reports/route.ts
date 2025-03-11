import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '~~/utils/db';

export async function POST(req: NextRequest) {
  const { tokenId, userAddress, reason, nftDetails } = await req.json();
  if (!tokenId || !userAddress || !reason || !nftDetails) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  let connection;
  try {
    connection = await connectToDatabase();
    await connection.execute(
      'INSERT INTO reports (token_id, user_address, reason, nft_name, seller_address) VALUES (?, ?, ?, ?, ?)',
      [tokenId, userAddress, reason, nftDetails.name, nftDetails.seller]
    );

    return NextResponse.json({ message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Database insert error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
} 