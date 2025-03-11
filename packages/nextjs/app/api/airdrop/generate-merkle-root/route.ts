import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '~~/utils/db';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

export async function POST(req: NextRequest) {
  let connection;
  try {
    connection = await connectToDatabase();
    // 从数据库获取地址
    const [rows] = await connection.execute(
      `SELECT wallet_address FROM airdrop_addresses`
    );

    //console.log("Airdrop addresses:", rows);

    // 生成 Merkle Tree
    const leaves = rows.map(x => keccak256(x.wallet_address));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getRoot().toString('hex');

    // 为每个地址生成证明
    const proofs = rows.map(x => ({
      address: x.wallet_address,
      proof: tree.getProof(keccak256(x.wallet_address)).map(p => '0x' + p.data.toString('hex'))
    }));

    console.log("Generated Merkle Proofs:", JSON.stringify(proofs, null, 2));

    return NextResponse.json({ merkleRoot: root, merkleProofs: proofs });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}