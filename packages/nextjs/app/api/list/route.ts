import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '~~/utils/db';

export async function POST(req: NextRequest) {
  const { name, price } = await req.json();  // 接收 name 和 price

  console.log("Received name and price:", name, price);  // 确认接收的 name 和 price

  if (!name || !price) {
    return NextResponse.json({ error: 'NFT name and price are required' }, { status: 400 });
  }

  let connection;
  try {
    connection = await connectToDatabase();
    // 使用 name 更新对应的 price
    await connection.execute(
      `UPDATE nfts SET price = ? WHERE name = ?`, 
      [price, name]
    );

    return NextResponse.json({ message: 'NFT price updated successfully' });
  } catch (error) {
    console.error('Database update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}
