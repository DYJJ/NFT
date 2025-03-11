"use client";

import { MyHoldings } from "./_components";
import type { NextPage } from "next"; 
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth"; 
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useState, useEffect } from "react";
import { notification } from "~~/utils/scaffold-eth";

interface FragmentDetails {
  tokenUri: string;
  totalFragments: bigint;
  fragmentsAvailable: bigint;
  ownedCount: bigint;
  fragmentPrice: bigint;
  isListed: boolean;
}

interface ListingForm {
  amount: number;
  price: number;
}

const MyNFTs: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [fragmentDetails, setFragmentDetails] = useState<FragmentDetails | null>(null);
  const [metadata, setMetadata] = useState<{ name?: string; image?: string; description?: string }>({});
  const [showListingForm, setShowListingForm] = useState(false);
  const [listingForm, setListingForm] = useState<ListingForm>({
    amount: 1,
    price: 0,
  });

  const { data: tokenIdCounter } = useScaffoldReadContract({
    contractName: "YourCollectible", 
    functionName: "tokenIdCounter",  
    watch: true,                     
  });

  const { data: details } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "getSimpleFragmentDetails",
    args: [BigInt(1), connectedAddress],
    watch: true,
  });

  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");

  const handleRelist = async () => {
    if (!fragmentDetails) return;
    
    try {
      await writeContractAsync({
        functionName: "relistFragments",
        args: [
          BigInt(1), // tokenId 
          BigInt(listingForm.amount),
          BigInt(listingForm.price * 1e18), // 转换为 wei
        ],
      });
      
      notification.success("碎片上架成功！");
      setShowListingForm(false);
    } catch (error) {
      console.error("碎片上架失败:", error);
      notification.error("碎片上架失败");
    }
  };

  const handleDelist = async () => {
    if (!fragmentDetails) return;
    
    try {
      await writeContractAsync({
        functionName: "delistFragments",
        args: [BigInt(1)], // tokenId
      });
      
      notification.success("碎片下架成功！");
    } catch (error) {
      console.error("碎片下架失败:", error);
      notification.error("碎片下架失败");
    }
  };

  useEffect(() => {
    if (details) {
      if ((details as FragmentDetails).ownedCount > 0n) {
        setFragmentDetails(details as FragmentDetails);
        fetch(details.tokenUri)
          .then(res => res.json())
          .then(data => setMetadata(data))
          .catch(console.error);
      } else {
        setFragmentDetails(null);
        setMetadata({});
      }
    }
  }, [details]);

  return (
    <div>
      <style jsx>{`
        .fragment-card {
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
        }

        .fragment-card::before {
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

        .fragment-card:hover::before {
          opacity: 0.5;
        }

        .fragment-card:hover {
          transform: translateY(-10px);
          box-shadow: 0 20px 40px rgba(255, 99, 71, 0.2);
        }

        .nft-image-container {
          position: relative;
          overflow: hidden;
          border-radius: 15px;
          height: 250px;
        }

        .nft-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s;
        }

        .fragment-card:hover .nft-image {
          transform: scale(1.1);
        }

        .action-button {
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
        }

        .action-button:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 15px 30px rgba(255, 99, 71, 0.6);
        }

        .info-tag {
          background: linear-gradient(45deg, #FF6347, #FFB6C1);
          padding: 8px 16px;
          border-radius: 20px;
          color: white;
          font-weight: bold;
          margin: 4px 0;
        }
      `}</style>

      <RainbowKitCustomConnectButton />
      <h1 className="text-4xl text-center font-bold bg-gradient-to-r from-[#FF6347] to-[#FFB6C1] text-transparent bg-clip-text mb-8">
        我的NFT碎片
      </h1>
      
      <div className="flex flex-wrap justify-center gap-6 p-4">
        {fragmentDetails && fragmentDetails.ownedCount > 0n ? (
          <div 
            className="fragment-card"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 100;
              const y = ((e.clientY - rect.top) / rect.height) * 100;
              e.currentTarget.style.setProperty('--mouse-x', `${x}%`);
              e.currentTarget.style.setProperty('--mouse-y', `${y}%`);
            }}
          >
            <div className="nft-image-container">
              {metadata.image && (
                <img 
                  src={metadata.image} 
                  alt={metadata.name || "NFT"} 
                  className="nft-image"
                />
              )}
              <div className="absolute bottom-4 left-4 p-2 bg-black/50 backdrop-blur-sm rounded-xl">
                <span className="text-white">#{tokenIdCounter?.toString() || "1"}</span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <h2 className="text-xl font-bold text-white">{metadata.name || "加载中..."}</h2>
              <p className="text-gray-300">{metadata.description || "无描述"}</p>

              <div className="info-tag flex justify-between">
                <span>总碎片</span>
                <span>{fragmentDetails.totalFragments.toString()}</span>
              </div>

              <div className="info-tag flex justify-between">
                <span>可用碎片</span>
                <span>{fragmentDetails.fragmentsAvailable.toString()}</span>
              </div>

              <div className="info-tag flex justify-between">
                <span>我的碎片</span>
                <span>{fragmentDetails.ownedCount.toString()}</span>
              </div>

              <div className="info-tag flex justify-between">
                <span>碎片价格</span>
                <span>{(Number(fragmentDetails.fragmentPrice) / 1e18).toFixed(4)} ETH</span>
              </div>

              <div className="info-tag flex justify-between">
                <span>上架状态</span>
                <span className={fragmentDetails.isListed ? "text-green-300" : "text-red-300"}>
                  {fragmentDetails.isListed ? "已上架" : "未上架"}
                </span>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowListingForm(true)}
                  className="action-button flex-1"
                >
                  上架碎片
                </button>
                <button
                  onClick={handleDelist}
                  className="action-button flex-1"
                >
                  下架碎片
                </button>
              </div>
            </div>

            {showListingForm && (
              <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
                  <div className="fixed inset-0 transition-opacity">
                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                  </div>
                  <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">上架碎片</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            上架数量
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={fragmentDetails.ownedCount.toString()}
                            value={listingForm.amount}
                            onChange={(e) => setListingForm(prev => ({
                              ...prev,
                              amount: Math.max(1, parseInt(e.target.value) || 1)
                            }))}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            价格 (ETH)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            value={listingForm.price}
                            onChange={(e) => setListingForm(prev => ({
                              ...prev,
                              price: parseFloat(e.target.value) || 0
                            }))}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                      <button
                        type="button"
                        className="btn btn-primary w-full sm:w-auto sm:ml-3"
                        onClick={handleRelist}
                      >
                        确认上架
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline mt-3 sm:mt-0 w-full sm:w-auto"
                        onClick={() => setShowListingForm(false)}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-xl text-gray-400 mt-8 p-8 rounded-xl bg-gray-800/30 backdrop-blur-sm">
            您还没有拥有任何NFT碎片
          </div>
        )}
      </div>
    </div>
  );
};

export default MyNFTs;
