"use client";

import { useState, useEffect } from "react";
import type { NextPage } from "next"; 
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth"; 
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth"; 
import { notification } from "~~/utils/scaffold-eth"; 
import { addToIPFS } from "~~/utils/simpleNFT/ipfs-fetch"; 
import { MyHoldings } from "./_components";
import { ethers } from 'ethers';
import { BrowserProvider } from "ethers";

// API 方法用于将 NFT 数据保存到数据库
const fetchFromApi = ({ path, method, body }: { path: string; method: string; body?: object }) =>
  fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
    .then(response => response.json())
    .catch(error => console.error("Error:", error));

// 保存 NFT 数据到数据库
export const saveNFTToDB = (data: object) => {
  return fetchFromApi({
    path: '/api/nfts', // 修改为新的 API 路径
    method: 'POST',
    body: { data },
  });
};

// 在组件顶部定义转换函数
function etherToWei(etherString) {
    const ether = BigInt(Math.round(parseFloat(etherString) * 1e18));
    return ether.toString();
}

const CreateNFTPage: NextPage = () => {
  const { address: connectedAddress, isConnected, isConnecting } = useAccount();
  const [nftList, setNftList] = useState<any[]>([]); // 批量铸造的 NFT 列表
  const [name, setName] = useState(""); 
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null); 
  const [fileUrl, setFileUrl] = useState<string | null>(null); 
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]); 
  const [royaltyReceiver, setRoyaltyReceiver] = useState(""); // 版税接收者地址状态
  const [royaltyPercentage, setRoyaltyPercentage] = useState(""); // 版税百分比状态
  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");
  const [mintedCount, setMintedCount] = useState(0); // 铸造的 NFT 数量
  const [blindBoxPrice, setBlindBoxPrice] = useState(""); // 新增状态来存储盲盒价格
  const [blindBoxNFTs, setBlindBoxNFTs] = useState<any[]>([]); // 新增一个状态来存储即将添加到盲盒的NFT列表

  useEffect(() => {
    const savedImage = localStorage.getItem("nftImage"); 
    if (savedImage) {
      setFileUrl(savedImage); 
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageUrl = reader.result as string;
        setFileUrl(imageUrl); 
        localStorage.setItem("nftImage", imageUrl);
      };
      reader.readAsDataURL(selectedFile); 
    }
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value); 
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags((prevTags) => [...prevTags, trimmedTag]);
      setTagInput("");
    }
  };

  const handleAddNFT = () => {
    const newNFT = {
      name,
      description,
      tags,
      image: fileUrl,
      royaltyReceiver,
      royaltyPercentage: parseInt(royaltyPercentage),
    };
    setNftList((prevList) => [...prevList, newNFT]);
    setBlindBoxNFTs((prevList) => [...prevList, newNFT]);
    notification.success(`${newNFT.name} added to the list and Blind Box!`);
  };

  const handleMintBatch = async () => {
    if (nftList.length === 0) {
      notification.error("No NFTs to mint.");
      return;
    }

    // 上传所有NFT的metadata到IPFS
    const metadataList = await Promise.all(
      nftList.map(async (nft) => {
        const metadata = {
          name: nft.name,
          description: nft.description,
          image: nft.image,
          attributes: nft.tags.map(tag => ({ trait_type: "Tag", value: tag })), // NFT的属性
        };
        return addToIPFS(metadata); // 上传到IPFS
      })
    );

    const nftUris = metadataList.map((uploadedItem) => `${uploadedItem.IpfsHash}`);
    console.log("NFT URIs:", nftUris);

    const feeNumerators = nftList.map((nft) => nft.royaltyPercentage);
    const royaltyReceivers = nftList.map((nft) => nft.royaltyReceiver);

    const notificationId = notification.loading("Minting NFTs...");

    try {
      // 调用mintBatch方法
      const hash = await writeContractAsync({
        functionName: "mintBatch",
        args: [connectedAddress, nftUris, royaltyReceivers, feeNumerators],
      });

      // 使用新版本的 Provider
      const provider = new BrowserProvider(window.ethereum);
      const receipt = await provider.waitForTransaction(hash);
      
      // 添加调试日志
      console.log("Transaction Receipt:", receipt);
      
      // 安全地获取和转换gas值
      let gasFee;
      try {
        if (receipt && receipt.gasUsed && receipt.effectiveGasPrice) {
          const gasUsed = BigInt(receipt.gasUsed);
          const effectiveGasPrice = BigInt(receipt.effectiveGasPrice);
          gasFee = gasUsed * effectiveGasPrice;
          
          console.log("Gas Fee:", ethers.formatEther(gasFee), "ETH");
          console.log("Gas Used:", gasUsed.toString());
          console.log("Gas Price:", ethers.formatEther(effectiveGasPrice), "ETH");
        } else {
          console.log("Using transaction hash as fallback for gas calculation");
          const tx = await provider.getTransaction(hash);
          const gasPrice = tx.gasPrice || BigInt(0);
          const gasLimit = tx.gasLimit || BigInt(0);
          gasFee = gasPrice * gasLimit;
          
          console.log("Fallback Gas Fee:", ethers.formatEther(gasFee), "ETH");
        }
      } catch (gasError) {
        console.error("Error calculating gas:", gasError);
        gasFee = BigInt(0);
      }

      // 批量保存到数据库，现在包含gas费用，并确保数值在合理范围内
      const nftDataList = nftList.map((nft, index) => ({
        name: nft.name,
        description: nft.description,
        uri: nftUris[index],
        tags: JSON.stringify(nft.tags), // 确保tags是JSON字符串
        royaltyReceiver: nft.royaltyReceiver,
        royaltyPercentage: parseFloat(nft.royaltyPercentage), // 转换为数字
        gas_fee: ethers.formatEther(gasFee) // 转换为ETH单位的字符串
      }));

      await Promise.all(nftDataList.map(saveNFTToDB));

      notification.remove(notificationId);
      notification.success("NFTs Minted and saved to database successfully!");
      setMintedCount(nftList.length);
      setNftList([]);
    } catch (error) {
      notification.remove(notificationId);
      notification.error("Failed to mint NFTs or save to database.");
      console.error(error);
    }
  };

  const handleMintBlindBox = async () => {
    if (blindBoxNFTs.length === 0) {
      notification.error("No NFTs in the Blind Box list.");
      return;
    }

    // 上传所有NFT的metadata到IPFS
    const metadataList = await Promise.all(
      blindBoxNFTs.map(async (nft) => {
        const metadata = {
          name: nft.name,
          description: nft.description,
          image: nft.image,
          attributes: nft.tags.map(tag => ({ trait_type: "Tag", value: tag })),
        };
        return addToIPFS(metadata); // 上传到IPFS
      })
    );

    const nftUris = metadataList.map((uploadedItem) => `${uploadedItem.IpfsHash}`);
    const feeNumerators = blindBoxNFTs.map((nft) => nft.royaltyPercentage);
    const royaltyReceivers = blindBoxNFTs.map((nft) => nft.royaltyReceiver);
    const weiPrice = etherToWei(blindBoxPrice); // 使用转换函数

    const notificationId = notification.loading("Minting Blind Box...");

    try {
      const hash = await writeContractAsync({
        functionName: "mintBlindBox",
        args: [
          connectedAddress,
          nftUris,
          royaltyReceivers,
          feeNumerators.map(num => parseInt(num)),
          weiPrice
        ],
      });

      // 使用新版本的 Provider
      const provider = new BrowserProvider(window.ethereum);
      const receipt = await provider.waitForTransaction(hash);
      
      // 添加调试日志
      console.log("Blind Box Transaction Receipt:", receipt);
      
      // 安全地获取和转换gas值
      let gasFee;
      try {
        if (receipt && receipt.gasUsed && receipt.effectiveGasPrice) {
          const gasUsed = BigInt(receipt.gasUsed);
          const effectiveGasPrice = BigInt(receipt.effectiveGasPrice);
          gasFee = gasUsed * effectiveGasPrice;
          
          console.log("Blind Box Gas Fee:", ethers.formatEther(gasFee), "ETH");
          console.log("Gas Used:", gasUsed.toString());
          console.log("Gas Price:", ethers.formatEther(effectiveGasPrice), "ETH");
        } else {
          console.log("Using transaction hash as fallback for gas calculation");
          const tx = await provider.getTransaction(hash);
          const gasPrice = tx.gasPrice || BigInt(0);
          const gasLimit = tx.gasLimit || BigInt(0);
          gasFee = gasPrice * gasLimit;
          
          console.log("Fallback Gas Fee:", ethers.formatEther(gasFee), "ETH");
        }
      } catch (gasError) {
        console.error("Error calculating gas:", gasError);
        gasFee = BigInt(0);
      }

      // 保存到数据库，包含gas费用，并确保数值在合理范围内
      const nftDataList = blindBoxNFTs.map((nft, index) => ({
        name: nft.name,
        description: nft.description,
        uri: nftUris[index],
        tags: JSON.stringify(nft.tags), // 确保tags是JSON字符串
        royaltyReceiver: nft.royaltyReceiver,
        royaltyPercentage: parseFloat(nft.royaltyPercentage), // 转换为数字
        price: ethers.formatEther(BigInt(weiPrice)), // 转换为ETH单位的字符串
        gas_fee: ethers.formatEther(gasFee) // 转换为ETH单位的字符串
      }));

      await Promise.all(nftDataList.map(saveNFTToDB));

      notification.remove(notificationId);
      notification.success("Blind Box Minted Successfully!");
      setMintedCount(blindBoxNFTs.length);
      setBlindBoxNFTs([]);
    } catch (error) {
      notification.remove(notificationId);
      notification.error("Failed to mint Blind Box.");
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col items-center pt-10 min-h-screen p-5">
      <style jsx>{`
        .create-card {
          width: 100%;
          max-width: 480px;
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

        .create-card::before {
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

        .create-card:hover::before {
          opacity: 0.5;
        }

        .custom-input {
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 99, 71, 0.3);
          border-radius: 25px;
          padding: 10px 20px;
          color: white;
          transition: all 0.3s;
          width: 100%;
        }

        .custom-input:focus {
          border-color: #FF6347;
          box-shadow: 0 0 15px rgba(255, 99, 71, 0.3);
          outline: none;
        }

        .gradient-button {
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
        }

        .gradient-button:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 15px 30px rgba(255, 99, 71, 0.6);
        }

        .tag-container {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }

        .tag {
          background: linear-gradient(45deg, #FF6347, #FFB6C1);
          padding: 5px 15px;
          border-radius: 15px;
          color: white;
          font-size: 0.85rem;
          font-weight: 500;
        }
      `}</style>

      <div 
        className="create-card mb-8"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          e.currentTarget.style.setProperty('--mouse-x', `${x}%`);
          e.currentTarget.style.setProperty('--mouse-y', `${y}%`);
        }}
      >
        <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-[#FF6347] to-[#FFB6C1] text-transparent bg-clip-text mb-6">
          创建 NFT
        </h1>

        <div className="space-y-6">
          <div>
            <label className="block text-white text-lg mb-2 font-semibold">NFT 名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="custom-input"
              placeholder="输入 NFT 名称"
            />
          </div>

          <div>
            <label className="block text-white text-lg mb-2 font-semibold">NFT 描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="custom-input min-h-[100px]"
              placeholder="输入 NFT 描述"
            />
          </div>

          <div>
            <label className="block text-white text-lg mb-2 font-semibold">上传 NFT 图片</label>
            <label className="gradient-button flex items-center justify-center cursor-pointer">
              {file ? file.name : "选择文件"}
              <input type="file" onChange={handleFileChange} className="hidden" />
            </label>
            {fileUrl && (
              <div className="mt-4 rounded-lg overflow-hidden">
                <img src={fileUrl} alt="NFT Preview" className="w-full h-auto" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-white text-lg mb-2 font-semibold">添加标签</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={handleTagInputChange}
                className="custom-input flex-1"
                placeholder="输入标签"
              />
              <button onClick={handleAddTag} className="gradient-button" style={{ width: 'auto' }}>
                添加
              </button>
            </div>
            {tags.length > 0 && (
              <div className="tag-container">
                {tags.map((tag, index) => (
                  <span key={index} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-white text-lg mb-2 font-semibold">版税接收地址</label>
            <input
              type="text"
              value={royaltyReceiver}
              onChange={(e) => setRoyaltyReceiver(e.target.value)}
              className="custom-input"
              placeholder="输入版税接收地址"
            />
          </div>

          <div>
            <label className="block text-white text-lg mb-2 font-semibold">版税比例 (0-10000)</label>
            <input
              type="number"
              value={royaltyPercentage}
              onChange={(e) => setRoyaltyPercentage(e.target.value)}
              className="custom-input"
              placeholder="输入版税比例 (例如: 500 表示 5%)"
            />
          </div>

          <div>
            <label className="block text-white text-lg mb-2 font-semibold">盲盒价格 (ETH)</label>
            <input
              type="text"
              value={blindBoxPrice}
              onChange={(e) => setBlindBoxPrice(e.target.value)}
              className="custom-input"
              placeholder="输入盲盒价格 (ETH)"
            />
          </div>

          <button className="gradient-button" onClick={handleAddNFT}>
            添加 NFT
          </button>

          {!isConnected || isConnecting ? (
            <RainbowKitCustomConnectButton />
          ) : (
            <>
              <button className="gradient-button" onClick={handleMintBatch}>
                批量铸造
              </button>
              <button className="gradient-button" onClick={handleMintBlindBox}>
                放入盲盒
              </button>
            </>
          )}
        </div>

        {/* NFT 列表展示 */}
        {nftList.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-bold text-white mb-4">待铸造的 NFT:</h3>
            <div className="space-y-4">
              {nftList.map((nft, index) => (
                <div key={index} className="create-card p-4">
                  <h4 className="text-lg font-bold text-white">{nft.name}</h4>
                  <p className="text-gray-300 mt-2">{nft.description}</p>
                  <div className="tag-container mt-3">
                    {nft.tags.map((tag, tagIndex) => (
                      <span key={tagIndex} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 text-gray-300">
                    <p>版税接收者: {nft.royaltyReceiver}</p>
                    <p>版税比例: {nft.royaltyPercentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mintedCount > 0 && (
          <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-[#FF6347]/20 to-[#FFB6C1]/20">
            <p className="text-xl text-center text-white">
              成功铸造 {mintedCount} 个 NFT!
            </p>
          </div>
        )}
      </div>

      <MyHoldings />
    </div>
  );
};

export default CreateNFTPage;
