import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '~~/utils/db';

export async function POST(req: NextRequest) {
  const { tokenId, userAddress, action } = await req.json();
  if (!tokenId || !userAddress || !action) {
    return NextResponse.json({ error: 'TokenId, userAddress and action are required' }, { status: 400 });
  }

  let connection;
  try {
    connection = await connectToDatabase();

    if (action === 'add') {
      await connection.execute(
        'INSERT INTO favorites (token_id, user_address) VALUES (?, ?)',
        [tokenId, userAddress]
      );
    } else if (action === 'remove') {
      await connection.execute(
        'DELETE FROM favorites WHERE token_id = ? AND user_address = ?',
        [tokenId, userAddress]
      );
    }

    return NextResponse.json({ message: 'Favorite updated successfully' });
  } catch (error) {
    console.error('Database update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userAddress = searchParams.get('userAddress');
  
  if (!userAddress) {
    return NextResponse.json({ error: 'UserAddress is required' }, { status: 400 });
  }

  let connection;
  try {
    connection = await connectToDatabase();
    const [favorites] = await connection.execute(
      'SELECT token_id FROM favorites WHERE user_address = ?',
      [userAddress]
    );

    return NextResponse.json({ favorites });
  } catch (error) {
    console.error('Database query error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
} 