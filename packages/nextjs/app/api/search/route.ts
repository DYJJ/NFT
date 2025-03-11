// routes.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '~~/utils/db';

// 处理 GET 请求来检索 NFT 数据
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name');
  const minPrice = req.nextUrl.searchParams.get('minPrice');
  const maxPrice = req.nextUrl.searchParams.get('maxPrice');

  if (!name && !minPrice && !maxPrice) {
    return NextResponse.json({ error: 'At least one search parameter (name, minPrice, or maxPrice) is required' }, { status: 400 });
  }

  let connection;
  try {
    connection = await connectToDatabase();
    
    const conditions: string[] = [];
    const values: (string | number)[] = [];
    
    if (name) {
      conditions.push('name LIKE ?');
      values.push(`%${name}%`);
    }
    if (minPrice) {
      conditions.push('price >= ?');
      values.push(parseFloat(minPrice));
    }
    if (maxPrice) {
      conditions.push('price <= ?');
      values.push(parseFloat(maxPrice));
    }

    const query = `SELECT * FROM nfts ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}`;
    
    const [nfts] = await connection.execute(query, values);
    
    return NextResponse.json(nfts);
  } catch (error) {
    console.error('Database retrieval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}
