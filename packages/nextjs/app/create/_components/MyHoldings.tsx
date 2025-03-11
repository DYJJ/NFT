"use client"; 
// Next.js 特定的指令，表明此文件仅在客户端渲染。

import { useEffect, useState } from "react";
// React hooks，用于管理组件的生命周期和状态。

import { useAccount } from "wagmi";
// wagmi 是一个用于与以太坊交互的库，`useAccount` hook 用于获取当前连接的钱包地址。

import { useScaffoldContract } from "~~/hooks/scaffold-eth";
// 导入自定义 hook，用于与智能合约进行交互（读取或写入）。

export const MyHoldings = () => {
  const { address: connectedAddress } = useAccount();
  const [nfts, setNfts] = useState<any[]>([]);
  const { data: nftContract } = useScaffoldContract({
    contractName: "YourCollectible",
  });

  useEffect(() => {
    const fetchNFTs = async () => {
      if (!nftContract || !connectedAddress) return;

      try {
        const balance = await nftContract.read.balanceOf([connectedAddress]);
        const nftArray = [];

        for (let i = 0; i < balance; i++) {
          const tokenId = await nftContract.read.tokenOfOwnerByIndex([connectedAddress, i]);
          const tokenURI = await nftContract.read.tokenURI([tokenId]);
          
          try {
            const response = await fetch(tokenURI);
            const metadata = await response.json();
            nftArray.push({
              tokenId,
              ...metadata,
            });
          } catch (error) {
            console.error("Error fetching metadata:", error);
          }
        }

        setNfts(nftArray);
      } catch (error) {
        console.error("Error fetching NFTs:", error);
      }
    };

    fetchNFTs();
  }, [nftContract, connectedAddress]);

  return (
    <div className="w-full max-w-[1200px]">
      <style jsx>{`
        .holdings-card {
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
        }

        .holdings-card::before {
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

        .holdings-card:hover::before {
          opacity: 0.5;
        }

        .nft-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
          padding: 20px;
        }

        .nft-image-container {
          position: relative;
          overflow: hidden;
          border-radius: 15px;
          aspect-ratio: 1;
        }

        .nft-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s;
        }

        .holdings-card:hover .nft-image {
          transform: scale(1.1);
        }

        .tag {
          background: linear-gradient(45deg, #FF6347, #FFB6C1);
          padding: 5px 15px;
          border-radius: 15px;
          color: white;
          font-size: 0.85rem;
          font-weight: 500;
          display: inline-block;
          margin: 4px;
        }
      `}</style>

      <div className="holdings-card">
        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-[#FF6347] to-[#FFB6C1] text-transparent bg-clip-text mb-6">
          我的 NFT 收藏
        </h2>

        {nfts.length === 0 ? (
          <p className="text-center text-gray-300 py-8">还没有铸造任何 NFT</p>
        ) : (
          <div className="nft-grid">
            {nfts.map((nft, index) => (
              <div
                key={index}
                className="holdings-card"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  e.currentTarget.style.setProperty('--mouse-x', `${x}%`);
                  e.currentTarget.style.setProperty('--mouse-y', `${y}%`);
                }}
              >
                <div className="nft-image-container">
                  <img
                    src={nft.image}
                    alt={nft.name}
                    className="nft-image"
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-xl font-bold text-white mb-2">{nft.name}</h3>
                  <p className="text-gray-300 mb-4">{nft.description}</p>
                  {nft.attributes && (
                    <div className="flex flex-wrap gap-2">
                      {nft.attributes.map((attr: any, attrIndex: number) => (
                        <span key={attrIndex} className="tag">
                          {attr.value}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-gray-300 mt-4">
                    Token ID: {nft.tokenId.toString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
