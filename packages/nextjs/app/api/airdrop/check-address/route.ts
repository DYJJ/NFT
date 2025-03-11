import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '~~/utils/db';

export async function POST(req: NextRequest) {
  let connection;
  try {
    connection = await connectToDatabase();
    
    // 从数据库查询空投地址
    const [rows] = await connection.execute(
      `SELECT wallet_address FROM airdrop_addresses`
    );

    // 直接使用字符串类型的 wallet_address
    const parsedAddresses = rows.map(row => row.wallet_address).filter(address => address);  // 直接取 wallet_address 字段，去掉空值

    // 输出解析后的地址
    console.log("Parsed Airdrop addresses:", parsedAddresses);

    return NextResponse.json({ addresses: parsedAddresses });  // 返回解析后的地址列表

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } 
}
