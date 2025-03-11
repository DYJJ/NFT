// route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '~~/utils/db';

// 处理 POST 请求来更新 NFT 数据
export async function POST(req: NextRequest) {
  const { data } = await req.json();
  if (!data) {
    return NextResponse.json({ error: 'NFT data is required' }, { status: 400 });
  }

  let connection;
  try {
    connection = await connectToDatabase();
    
    // 处理数据以确保符合数据库要求
    const processedData = {
      ...data,
      royaltyPercentage: parseFloat(data.royaltyPercentage) || 0,
      price: data.price ? parseFloat(data.price) : null,
      gas_fee: parseFloat(data.gas_fee) || 0,
      tags: typeof data.tags === 'string' ? data.tags : JSON.stringify(data.tags)
    };

    const fields = Object.keys(processedData).map(key => `${key} = ?`).join(", ");
    const values = Object.values(processedData);

    const sql = `
      INSERT INTO nfts (${Object.keys(processedData).join(", ")}) 
      VALUES (${values.map(() => '?').join(", ")})
      ON DUPLICATE KEY UPDATE ${fields}
    `;

    await connection.execute(sql, [...values, ...values]);

    return NextResponse.json({ 
      message: 'NFT data updated successfully',
      gasFee: processedData.gas_fee
    });
  } catch (error) {
    console.error('Database update error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}


