import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '~~/utils/db';

// 处理添加空投地址的 POST 请求
export async function POST(req: NextRequest) {
  const { addresses } = await req.json();
  
  // 验证输入
  if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
    return NextResponse.json({ error: 'Valid addresses array is required' }, { status: 400 });
  }

  let connection;
  try {
    connection = await connectToDatabase();
    
    // 准备插入的值，确保每个地址都是字符串
    const values = addresses.map(address => `('${String(address)}')`).join(", ");
    
    // 构建 SQL 查询
    const sql = `
      INSERT INTO airdrop_addresses (wallet_address) 
      VALUES ${values}
      ON DUPLICATE KEY UPDATE wallet_address = VALUES(wallet_address)
    `;

    // 执行 SQL 查询
    await connection.query(sql);

    return NextResponse.json({ 
      message: 'Airdrop addresses added successfully',
      count: addresses.length 
    });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}
