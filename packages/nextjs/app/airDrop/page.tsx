"use client";

import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { useState, useEffect } from "react";

// 1. 用户输入空投地址并保存到数据库
const saveAirdropAddressToDB = async (airdropAddress: string, connectedAddress: string, setCallerAddress: (address: string) => void) => {
  console.log("Calling saveAirdropAddressToDB from address:", connectedAddress);

  const response = await fetch('/api/airdrop', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ addresses: [airdropAddress] }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('API Error:', data);
    return;
  }
  console.log("Airdrop address saved successfully:", data);
  localStorage.setItem('registeredAirdropAddress', airdropAddress);
  setCallerAddress(connectedAddress);
};
const MyNFTs: NextPage = () => {
  const { address: connectedAddress, isConnected, isConnecting } = useAccount();
  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");
  const [ownershipCount, setOwnershipCount] = useState<number | undefined>(undefined);
  const [airdropAddress, setAirdropAddress] = useState("");
  const [callerAddress, setCallerAddress] = useState("");
  const [tokenId, setTokenId] = useState<number | undefined>(undefined); // 新增 tokenId 状态
  const [merkleRoot, setMerkleRoot] = useState<string | undefined>(undefined);  // 新增 merkleRoot 状态

  const { data: tokenIdCounter } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "tokenIdCounter",
    watch: true,
  });

  const { data: fragmentOwnershipCount, isLoading: isLoadingFragmentCount } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "getFragmentOwnershipCount",
    args: [BigInt(1), connectedAddress],
  });

  useEffect(() => {
    if (!isLoadingFragmentCount && fragmentOwnershipCount !== undefined) {
      console.log(`Fragment Ownership Count: ${fragmentOwnershipCount}`);
      setOwnershipCount(Number(fragmentOwnershipCount));
    }
  }, [fragmentOwnershipCount, isLoadingFragmentCount]);

  // 2. 生成 Merkle Root 并上传到链上
  const generateAndUploadMerkleRoot = async () => {
    if (connectedAddress !== callerAddress) {
      alert("当前 MetaMask 地址与 callerAddress 不匹配，无法生成并上传 Merkle Root");
      return;
    }

    const response = await fetch('/api/airdrop/generate-merkle-root', {
      method: 'POST',
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('API Error:', data);
      return;
    }
    console.log("Generated Merkle Root:", data.merkleRoot);
    setMerkleRoot(data.merkleRoot);  // 保存生成的 merkleRoot
    await updateMerkleRootOnChain(data.merkleRoot);
  };

  const updateMerkleRootOnChain = async (merkleRoot) => {
    try {
      const tx = await writeContractAsync({
        contractName: "YourCollectible",
        functionName: "setMerkleRoot",
        args: [merkleRoot],
      });

    } catch (error) {
      console.error("Failed to update Merkle Root on chain:", error);
    }
  };

  const claimAirdrop = async (tokenId: number, merkleRoot: string) => {
    if (!connectedAddress) {
      console.error('No connected wallet address');
      return;
    }

    console.log("Current MetaMask address:", connectedAddress);  // 打印当前的 MetaMask 地址

    // 查询数据库，检查当前地址是否已注册
    const addressExists = await checkAddressInDB(connectedAddress);
    if (!addressExists) {
      console.log('该地址未注册，无法领取空投');
      notification.error('地址未注册，无法领取空投');
      return;
    }

    console.log("Attempting to claim airdrop with tokenId:", tokenId, "and merkleRoot:", merkleRoot);

    try {
      const tx = await writeContractAsync({
        contractName: "YourCollectible",
        functionName: "claimAirdrop",
        args: [tokenId, merkleRoot],
      });
      console.log("Airdrop claimed successfully. Transaction details:", tx);
    } catch (error) {
      console.error("Failed to claim airdrop. Error:", error);
    }
  };

  const checkAddressInDB = async (address: string) => {
    const response = await fetch('/api/airdrop/check-address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('API Error:', data);
      return false;
    }

    // 打印从数据库获取的地址
    console.log("Database addresses:", data.addresses);  // 假设返回的 JSON 数据有一个 addresses 字段

    // 假设数据结构类似：{ addresses: ['address1', 'address2', ...] }
    const addressExists = data.addresses.includes(address);
    return addressExists;  // 返回是否存在该地址
  };



  return (
    <>
      <style jsx>{`
        .airdrop-card {
          width: 320px;
          position: relative;
          padding: 20px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          overflow: hidden;
          transform-style: preserve-3d;
          margin: 20px auto;
        }

        .airdrop-card::before {
          content: '';
          position: absolute;
          inset: -1px;
          z-index: -2;
          background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
              rgba(255, 99, 71, 0.8),
              rgba(255, 182, 193, 0.8),
              transparent 70%);
          opacity: 0;
          transition: opacity 0.4s;
          border-radius: 20px;
          filter: blur(8px);
        }

        .airdrop-card:hover::before {
          opacity: 0.5;
        }

        .airdrop-input {
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 99, 71, 0.3);
          border-radius: 25px;
          padding: 10px 20px;
          color: white;
          transition: all 0.3s;
          width: 100%;
          margin-bottom: 10px;
        }

        .airdrop-input:focus {
          border-color: #FF6347;
          box-shadow: 0 0 15px rgba(255, 99, 71, 0.3);
          outline: none;
        }

        .airdrop-button {
          background: linear-gradient(45deg, #FF6347, #FFB6C1);
          border: none;
          padding: 12px 30px;
          color: white;
          border-radius: 50px;
          transform: translateY(0);
          transition: all 0.4s;
          box-shadow: 0 5px 15px rgba(255, 99, 71, 0.4);
          font-weight: bold;
          letter-spacing: 1px;
          text-transform: uppercase;
          font-size: 0.85rem;
          width: 100%;
          margin-bottom: 10px;
        }

        .airdrop-button:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 15px 30px rgba(255, 99, 71, 0.6);
        }
      `}</style>

      <div className="flex items-center flex-col pt-10">
        <div className="px-5">
          <h1 className="text-4xl text-center font-bold bg-gradient-to-r from-[#FF6347] to-[#FFB6C1] text-transparent bg-clip-text mb-8">
            我的空投
          </h1>
        </div>

        <div className="airdrop-card"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            e.currentTarget.style.setProperty('--mouse-x', `${x}%`);
            e.currentTarget.style.setProperty('--mouse-y', `${y}%`);
          }}
        >
          <input
            type="text"
            placeholder="输入空投地址"
            value={airdropAddress}
            onChange={e => setAirdropAddress(e.target.value)}
            className="airdrop-input"
          />
          <button
            onClick={() => saveAirdropAddressToDB(airdropAddress, connectedAddress, setCallerAddress)}
            className="airdrop-button"
          >
            添加空投地址
          </button>
          <button
            onClick={generateAndUploadMerkleRoot}
            className="airdrop-button"
          >
            生成并上传默克尔根
          </button>
          <button
            onClick={() => claimAirdrop(tokenId, merkleRoot || "")}
            className="airdrop-button"
          >
            领取空投
          </button>

          <input
            type="number"
            placeholder="输入 NFT ID"
            value={tokenId || ""}
            onChange={e => setTokenId(Number(e.target.value))}
            className="airdrop-input"
          />
        </div>
      </div>


    </>
  );
};

export default MyNFTs;
