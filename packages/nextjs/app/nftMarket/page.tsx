"use client";

// 导入所需的组件和工具
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { useEffect, useState } from "react";
import { Address, AddressInput } from "~~/components/scaffold-eth";
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { OrbitControls, Stage, useGLTF } from '@react-three/drei';

// 在文件顶部添加一个全局样式类
const textStyle = {
    color: '#000000'
};

// 在文件顶部添加样式常量
const filterStyle = {
    borderColor: '#C71585',
    color: '#C71585',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',  // 半透明的输入框背景
    '::placeholder': {
        color: '#C71585',
        opacity: 0.7
    }
};

const buttonStyle = {
    backgroundColor: '#C71585',
    color: 'white',
    border: 'none',
    transition: 'all 0.3s ease',
    ':hover': {
        backgroundColor: '#DB7093',
        transform: 'translateY(-2px)'
    },
    boxShadow: '0 4px 6px rgba(199, 21, 133, 0.2)',
    whiteSpace: 'nowrap'
};

// 添加筛选框容器样式
const filterContainerStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0)',  // 完全透明的背景
    backdropFilter: 'blur(12px)',  // 增加模糊效果
    borderRadius: '0.75rem',
    boxShadow: '0 4px 6px rgba(199, 21, 133, 0.1)',
    border: '1px solid rgba(199, 21, 133, 0.2)'  // 添加一个淡粉色边框增加可见度
};

// 在组件中添加3D模型展示
function Model() {
    const { scene } = useGLTF('/小火龙3D.glb');
    return <primitive object={scene} scale={0.35} />;
}

function Model1() {
    const { scene } = useGLTF('/杰尼龟3D.glb');
    return <primitive object={scene} scale={0.35} />;
}

// NFT 列表组件
const NFTListings: NextPage = () => {
    const { address } = useAccount();
    const [nftListings, setNftListings] = useState<any[]>([]);
    const [filteredNFTs, setFilteredNFTs] = useState<any[]>([]);
    const [nameFilter, setNameFilter] = useState<string>(""); // 用于名称过滤
    const [minPriceFilter, setMinPriceFilter] = useState<number | "">(""); // 最低价格过滤
    const [maxPriceFilter, setMaxPriceFilter] = useState<number | "">(""); // 最高价格过滤
    const [tagFilter, setTagFilter] = useState<string>("");  // 添加标签筛选状态

    // 添加一个状态来存储每个NFT的购买碎片数量
    const [fragmentAmounts, setFragmentAmounts] = useState<{ [key: string]: number }>({});

    const { data, isError, isLoading } = useScaffoldReadContract({
        contractName: "YourCollectible",
        functionName: "getListedNFTs",
        args: [],
    });

    // 在文件顶部添加状态
    const [favorites, setFavorites] = useState<string[]>([]);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [selectedNFT, setSelectedNFT] = useState<any>(null);
    const [reportReason, setReportReason] = useState("");
    const [rentalNFTs, setRentalNFTs] = useState<any[]>([]);

    // 添加获取租赁NFT的合约调用
    const { data: rentalData, isError: isRentalError, isLoading: isRentalLoading } = useScaffoldReadContract({
        contractName: "YourCollectible",
        functionName: "getAllRentals",
        args: [],
    });

    // 在 useEffect 中获取用户的收藏列表
    useEffect(() => {
        const fetchFavorites = async () => {
            if (!address) return;
            try {
                const response = await fetch(`/api/favorites?userAddress=${address}`);
                const data = await response.json();
                if (data.favorites) {
                    setFavorites(data.favorites.map((f: any) => f.token_id));
                }
            } catch (error) {
                console.error("获取收藏列表失败:", error);
            }
        };

        fetchFavorites();
    }, [address]);

    // 添加收藏/取消收藏功能
    const toggleFavorite = async (tokenId: string) => {
        if (!address) {
            notification.error("请先连接钱包");
            return;
        }

        try {
            const response = await fetch('/api/favorites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tokenId,
                    userAddress: address,
                    action: favorites.includes(tokenId) ? 'remove' : 'add'
                })
            });

            if (response.ok) {
                setFavorites(prev => 
                    prev.includes(tokenId) 
                        ? prev.filter(id => id !== tokenId)
                        : [...prev, tokenId]
                );
                notification.success(
                    favorites.includes(tokenId) ? "已取消收藏" : "收藏成功"
                );
            }
        } catch (error) {
            notification.error("操作失败");
        }
    };

    // 添加举报功能
    const handleReport = async () => {
        if (!address) {
            notification.error("请先连接钱包");
            return;
        }

        if (!selectedNFT || !reportReason) {
            notification.error("请填写举报原因");
            return;
        }

        try {
            const response = await fetch('/api/reports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tokenId: selectedNFT.tokenId.toString(),
                    userAddress: address,
                    reason: reportReason,
                    nftDetails: {
                        name: selectedNFT.name,
                        seller: selectedNFT.seller
                    }
                })
            });

            if (response.ok) {
                notification.success("举报已提交");
                setReportModalOpen(false);
                setReportReason("");
                setSelectedNFT(null);
            }
        } catch (error) {
            notification.error("举报提交失败");
        }
    };

    useEffect(() => {
        if (data) {
            const fetchMetadata = async () => {
                const nftData = await Promise.all(
                    data.map(async (nft: any) => {
                        try {
                            const response = await fetch(nft.tokenUri);
                            if (!response.ok) {
                                throw new Error("元数据加载失败");
                            }
                            const metadata = await response.json();
                            return {
                                ...nft,
                                image: metadata.image || "",
                                name: metadata.name || `NFT #${nft.tokenId.toString()}`,
                                description: metadata.description || "无描述",
                                attributes: metadata.attributes || [],
                            };
                        } catch (error) {
                            console.error(`获取 NFT 元数据失败: ${error}`);
                            return {
                                ...nft,
                                image: "",
                                name: `NFT #${nft.tokenId.toString()}`,
                                description: "无描述",
                                attributes: [],
                            };
                        }
                    })
                );
                setNftListings(nftData);
                setFilteredNFTs(nftData);  // 设置初始显示的 NFT 列表
            };

            fetchMetadata();
        }

        if (isError) {
            notification.error("获取 NFT 列表失败");
        }
    }, [data, isError]);

    // 在 useEffect 中处理租赁数据
    useEffect(() => {
        if (rentalData) {
            const fetchRentalMetadata = async () => {
                const nftData = await Promise.all(
                    rentalData.map(async (nft: any) => {
                        try {
                            const response = await fetch(nft.tokenUri);
                            if (!response.ok) {
                                throw new Error("元数据加载失败");
                            }
                            const metadata = await response.json();
                            return {
                                ...nft,
                                image: metadata.image || "",
                                name: metadata.name || `NFT #${nft.tokenId.toString()}`,
                                description: metadata.description || "无描述",
                                attributes: metadata.attributes || [],
                            };
                        } catch (error) {
                            console.error(`获取租赁 NFT 元数据失败: ${error}`);
                            return {
                                ...nft,
                                image: "",
                                name: `NFT #${nft.tokenId.toString()}`,
                                description: "无描述",
                                attributes: [],
                            };
                        }
                    })
                );
                setRentalNFTs(nftData);
            };

            fetchRentalMetadata();
        }

        if (isRentalError) {
            notification.error("获取租赁 NFT 列表失败");
        }
    }, [rentalData, isRentalError]);

    const filterNFTs = () => {
        let filtered = nftListings;

        // 按名称过滤
        if (nameFilter) {
            filtered = filtered.filter((nft) => nft.name.toLowerCase().includes(nameFilter.toLowerCase()));
        }

        // 按价格过滤
        if (minPriceFilter !== "" && !isNaN(Number(minPriceFilter))) {
            filtered = filtered.filter((nft) => Number(nft.price) >= minPriceFilter * 1e18);
        }

        if (maxPriceFilter !== "" && !isNaN(Number(maxPriceFilter))) {
            filtered = filtered.filter((nft) => Number(nft.price) <= maxPriceFilter * 1e18);
        }

        // 按标签过滤
        if (tagFilter) {
            filtered = filtered.filter((nft) => 
                nft.attributes?.some(attr => 
                    attr.trait_type === "Tag" && 
                    attr.value.toLowerCase().includes(tagFilter.toLowerCase())
                )
            );
        }

        setFilteredNFTs(filtered);
    };

    const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");

    // 处理碎片数量变化
    const handleFragmentAmountChange = (tokenId: string, value: number) => {
        setFragmentAmounts(prev => ({
            ...prev,
            [tokenId]: value
        }));
    };

    const buyNFT = async (nft: any) => {
        if (nft.seller.toLowerCase() === address?.toLowerCase()) {
            notification.error("不能购买自己的 NFT");
            return;
        }

        try {
            if (nft.isFragmented) {
                const fragmentAmount = fragmentAmounts[nft.tokenId.toString()] || 1;
                // 如果是碎片NFT的NFT，调用buyFragment函数
                await writeContractAsync({
                    functionName: "buyFragment",
                    args: [BigInt(nft.tokenId.toString()), BigInt(fragmentAmount)],
                    value: BigInt(nft.price) * BigInt(fragmentAmount),
                });
            } else {
                // 普通NFT购买逻辑
                await writeContractAsync({
                    functionName: "buyNFT",
                    args: [BigInt(nft.tokenId.toString())],
                    value: nft.price,
                });
            }
            
            notification.success("NFT 购买成功！");
            setNftListings((prevListings) =>
                prevListings.filter((item) => item.tokenId !== nft.tokenId)
            );
        } catch (error) {
            console.error("购买 NFT 失败:", error);
            notification.error("购买 NFT 失败");
        }
    };

    // 添加租赁 NFT 的处理函数
    const rentNFT = async (nft: any) => {
        if (nft.owner.toLowerCase() === address?.toLowerCase()) {
            notification.error("不能租用自己的 NFT");
            return;
        }

        try {
            await writeContractAsync({
                functionName: "rent",
                args: [BigInt(nft.tokenId.toString())],
                value: nft.price,
            });
            
            notification.success("NFT 租用成功！");
            // 更新租赁列表
            setRentalNFTs((prevListings) =>
                prevListings.filter((item) => item.tokenId !== nft.tokenId)
            );
        } catch (error) {
            console.error("租用 NFT 失败:", error);
            notification.error("租用 NFT 失败");
        }
    };

    return (
        <div>
            <style jsx>{`
                .nft-card {
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
                    color: white;
                }

                .nft-card::before {
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

                .nft-card:hover::before {
                    opacity: 0.5;
                }

                .nft-card:hover {
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

                .nft-card:hover .nft-image {
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
                    width: 100%;
                    margin-top: 10px;
                }

                .action-button:hover {
                    transform: translateY(-3px) scale(1.05);
                    box-shadow: 0 15px 30px rgba(255, 99, 71, 0.6);
                }

                .action-button:disabled {
                    background: #cccccc;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                .price-tag {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: rgba(255, 99, 71, 0.9);
                    padding: 8px 16px;
                    border-radius: 20px;
                    color: white;
                    font-weight: bold;
                    backdrop-filter: blur(5px);
                }

                .tag-badge {
                    background: linear-gradient(45deg, #FF6347, #FFB6C1);
                    color: white;
                    padding: 5px 12px;
                    border-radius: 15px;
                    font-size: 0.9rem;
                    margin: 0 4px 4px 0;
                    display: inline-block;
                    transition: all 0.3s;
                }

                .tag-badge:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(255, 99, 71, 0.3);
                }

                .fragment-input {
                    background: rgba(255, 255, 255, 0.1);
                    border: 2px solid rgba(255, 99, 71, 0.3);
                    border-radius: 25px;
                    padding: 10px 20px;
                    color: black;
                    transition: all 0.3s;
                    width: 100%;
                    margin-bottom: 10px;
                }

                .fragment-input:focus {
                    border-color: #FF6347;
                    box-shadow: 0 0 15px rgba(255, 99, 71, 0.3);
                    outline: none;
                }

                .rental-card {
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
                    color: white;
                }

                .rental-card::before {
                    content: '';
                    position: absolute;
                    inset: -1px;
                    z-index: -2;
                    background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
                        rgba(64, 224, 208, 0.8),
                        rgba(100, 149, 237, 0.8),
                        transparent 70%);
                    opacity: 0;
                    transition: opacity 0.4s;
                    border-radius: 20px;
                    filter: blur(8px);
                }

                .rental-card:hover::before {
                    opacity: 0.5;
                }

                .rental-card:hover {
                    transform: translateY(-10px);
                    box-shadow: 0 20px 40px rgba(64, 224, 208, 0.2);
                }

                .rental-price-tag {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: linear-gradient(45deg, #40E0D0, #6495ED);
                    padding: 8px 16px;
                    border-radius: 20px;
                    color: white;
                    font-weight: bold;
                    backdrop-filter: blur(5px);
                }

                .rental-button {
                    background: linear-gradient(45deg, #40E0D0, #6495ED);
                    border: none;
                    padding: 12px 30px;
                    color: white;
                    border-radius: 50px;
                    transform: translateY(0);
                    transition: all 0.4s;
                    box-shadow: 0 5px 15px rgba(64, 224, 208, 0.4);
                    font-weight: bold;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    font-size: 0.85rem;
                    width: 100%;
                    margin-top: 10px;
                }

                .rental-button:hover {
                    transform: translateY(-3px) scale(1.05);
                    box-shadow: 0 15px 30px rgba(64, 224, 208, 0.6);
                }

                .rental-button:disabled {
                    background: #cccccc;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                .rental-duration {
                    background: linear-gradient(45deg, #40E0D0, #6495ED);
                    padding: 8px 16px;
                    border-radius: 20px;
                    color: white;
                    font-weight: bold;
                    display: inline-block;
                    margin-top: 10px;
                }

                .rental-loading {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 200px;
                }

                .rental-loading-spinner {
                    width: 50px;
                    height: 50px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #40E0D0;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>

            <RainbowKitCustomConnectButton />
            <h1 className="text-4xl text-center text-gradient mb-4" style={textStyle}>NFT商城</h1>
            {/* 修改3D模型展示区域，减小间距 */}
            <div className="flex justify-center gap-4 mb-6" style={{ width: '100%', height: '300px' }}>
                <div style={{ width: '30%', height: '100%' }}>
                    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 5], fov: 50 }}>
                        <Suspense fallback={null}>
                            <Stage environment="city" intensity={0.5}>
                                <Model />
                            </Stage>
                            <OrbitControls />
                        </Suspense>
                    </Canvas>
                </div>
                <div style={{ width: '30%', height: '100%' }}>
                    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 5], fov: 50 }}>
                        <Suspense fallback={null}>
                            <Stage environment="city" intensity={0.5}>
                                <Model1 />
                            </Stage>
                            <OrbitControls />
                        </Suspense>
                    </Canvas>
                </div>
            </div>

            {/* 搜索过滤 */}
            <div className="mb-8 w-full max-w-6xl mx-auto">
                <div style={filterContainerStyle} className="p-6">
                    <h2 className="text-2xl font-bold mb-4 text-center" style={{ color: '#C71585' }}>NFT 筛选</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="flex flex-col">
                            <label className="mb-2 font-semibold" style={{ color: '#C71585' }}>名称</label>
                            <input
                                type="text"
                                placeholder="输入NFT名称"
                                value={nameFilter}
                                onChange={(e) => setNameFilter(e.target.value)}
                                className="input input-bordered focus:outline-none focus:ring-2 focus:ring-pink-400"
                                style={filterStyle}
                            />
                        </div>
                        
                        <div className="flex flex-col">
                            <label className="mb-2 font-semibold" style={{ color: '#C71585' }}>最低价格</label>
                            <input
                                type="number"
                                placeholder="ETH"
                                value={minPriceFilter}
                                onChange={(e) => setMinPriceFilter(Number(e.target.value) || "")}
                                className="input input-bordered focus:outline-none focus:ring-2 focus:ring-pink-400"
                                style={filterStyle}
                            />
                        </div>
                        
                        <div className="flex flex-col">
                            <label className="mb-2 font-semibold" style={{ color: '#C71585' }}>最高价格</label>
                            <input
                                type="number"
                                placeholder="ETH"
                                value={maxPriceFilter}
                                onChange={(e) => setMaxPriceFilter(Number(e.target.value) || "")}
                                className="input input-bordered focus:outline-none focus:ring-2 focus:ring-pink-400"
                                style={filterStyle}
                            />
                        </div>
                        
                        <div className="flex flex-col">
                            <label className="mb-2 font-semibold" style={{ color: '#C71585' }}>标签</label>
                            <input
                                type="text"
                                placeholder="输入标签关键词"
                                value={tagFilter}
                                onChange={(e) => setTagFilter(e.target.value)}
                                className="input input-bordered focus:outline-none focus:ring-2 focus:ring-pink-400"
                                style={filterStyle}
                            />
                        </div>
                    </div>
                    
                    <div className="flex justify-center mt-6">
                        <button 
                            onClick={filterNFTs} 
                            className="btn px-8 py-2 rounded-lg transform hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
                            style={buttonStyle}
                        >
                            应用筛选
                        </button>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <p style={textStyle}>加载中...</p>
            ) : (
                <div className="flex flex-wrap justify-center gap-4">
                    {filteredNFTs.map((nft) => (
                        <div
                            key={nft.tokenId.toString()}
                            className="nft-card"
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
                                    src={nft.image || nft.tokenUri}
                                    alt={nft.name}
                                    className="nft-image"
                                />
                                <div className="price-tag">
                                    {(Number(nft.price) / 1e18).toFixed(4)} ETH
                                </div>
                            </div>

                            <div className="p-4 space-y-4">
                                <h2 className="text-xl font-bold text-white">{nft.name}</h2>
                                <p className="text-gray-200">{nft.description}</p>

                                {nft.attributes && nft.attributes.length > 0 && (
                                    <div className="flex flex-wrap mt-2">
                                        {nft.attributes
                                            .filter(attr => attr.trait_type === "Tag")
                                            .map((attr, index) => (
                                                <span key={index} className="tag-badge">
                                                    {attr.value}
                                                </span>
                                            ))
                                        }
                                    </div>
                                )}

                                <div className="text-sm text-gray-300">
                                    <div className="mb-2">
                                        <span className="font-semibold">拥有者: </span>
                                        <Address address={nft.seller} />
                                    </div>
                                    
                                    {nft.isFragmented && (
                                        <div className="space-y-2">
                                            <div className="font-semibold">剩余碎片: {nft.fragmentsAvailable}</div>
                                            <input
                                                type="number"
                                                min="1"
                                                value={fragmentAmounts[nft.tokenId.toString()] || 1}
                                                onChange={(e) => handleFragmentAmountChange(
                                                    nft.tokenId.toString(),
                                                    Math.max(1, parseInt(e.target.value) || 1)
                                                )}
                                                className="fragment-input"
                                            />
                                            <div className="text-sm text-gray-300">
                                                总价: {((Number(nft.price) / 1e18) * (fragmentAmounts[nft.tokenId.toString()] || 1)).toFixed(4)} ETH
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleFavorite(nft.tokenId.toString())}
                                        className="action-button"
                                    >
                                        {favorites.includes(nft.tokenId.toString()) ? '取消收藏' : '收藏'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedNFT(nft);
                                            setReportModalOpen(true);
                                        }}
                                        className="action-button"
                                    >
                                        举报
                                    </button>
                                </div>

                                <button
                                    onClick={() => buyNFT(nft)}
                                    className="action-button"
                                    disabled={nft.seller.toLowerCase() === address?.toLowerCase()}
                                >
                                    {nft.seller.toLowerCase() === address?.toLowerCase()
                                        ? "您是卖家"
                                        : nft.isFragmented ? "购买碎片" : "购买 NFT"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 添加举报模态框 */}
            {reportModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity">
                            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                        </div>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">举报 NFT</h3>
                                <textarea
                                    className="w-full p-2 border rounded-md"
                                    rows={4}
                                    placeholder="请输入举报原因..."
                                    value={reportReason}
                                    onChange={(e) => setReportReason(e.target.value)}
                                />
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button
                                    type="button"
                                    className="btn btn-primary w-full sm:w-auto sm:ml-3"
                                    onClick={handleReport}
                                >
                                    提交举报
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-outline mt-3 sm:mt-0 w-full sm:w-auto"
                                    onClick={() => {
                                        setReportModalOpen(false);
                                        setReportReason("");
                                        setSelectedNFT(null);
                                    }}
                                >
                                    取消
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 租赁 NFT 展示区域 */}
            <div className="mt-12">
                <h2 className="text-3xl text-center font-bold bg-gradient-to-r from-[#40E0D0] to-[#6495ED] text-transparent bg-clip-text mb-8">
                    可租赁的 NFT
                </h2>
                {isRentalLoading ? (
                    <div className="rental-loading">
                        <div className="rental-loading-spinner"></div>
                    </div>
                ) : (
                    <div className="flex flex-wrap justify-center gap-4">
                        {rentalNFTs
                            .filter(nft => !nft.isRented)
                            .map((nft) => (
                                <div
                                    key={nft.tokenId.toString()}
                                    className="rental-card"
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
                                            src={nft.image || nft.tokenUri}
                                            alt={nft.name}
                                            className="nft-image"
                                        />
                                        <div className="rental-price-tag">
                                            租金: {(Number(nft.price) / 1e18).toFixed(4)} ETH
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-4">
                                        <h2 className="text-xl font-bold text-white">{nft.name}</h2>
                                        <p className="text-gray-200">{nft.description}</p>

                                        <div className="text-sm text-gray-300">
                                            <div className="mb-2">
                                                <span className="font-semibold">拥有者: </span>
                                                <Address address={nft.owner} />
                                            </div>
                                            
                                            <div className="rental-duration">
                                                ⏰ 租赁期限: {new Date(Number(nft.endTime) * 1000).toLocaleString()}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => rentNFT(nft)}
                                            className="rental-button"
                                            disabled={nft.owner.toLowerCase() === address?.toLowerCase()}
                                        >
                                            {nft.owner.toLowerCase() === address?.toLowerCase()
                                                ? "您是拥有者"
                                                : "立即租用 NFT"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NFTListings;

