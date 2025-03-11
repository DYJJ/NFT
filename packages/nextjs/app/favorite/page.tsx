"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { Address } from "~~/components/scaffold-eth";

const FavoritePage: NextPage = () => {
    const { address } = useAccount();
    const [favoriteNFTs, setFavoriteNFTs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 获取所有NFT列表
    const { data: allNFTs } = useScaffoldReadContract({
        contractName: "YourCollectible",
        functionName: "getListedNFTs",
        args: [],
    });

    // 获取用户的收藏列表并匹配NFT信息
    useEffect(() => {
        const fetchFavorites = async () => {
            if (!address) {
                setIsLoading(false);
                return;
            }

            try {
                // 获取收藏列表
                const response = await fetch(`/api/favorites?userAddress=${address}`);
                const data = await response.json();
                
                if (!data.favorites || !allNFTs) {
                    setIsLoading(false);
                    return;
                }

                // 获取收藏的NFT的详细信息
                const favoriteTokenIds = data.favorites.map((f: any) => f.token_id);
                const nftDetails = await Promise.all(
                    allNFTs
                        .filter((nft: any) => favoriteTokenIds.includes(nft.tokenId.toString()))
                        .map(async (nft: any) => {
                            try {
                                const response = await fetch(nft.tokenUri);
                                if (!response.ok) throw new Error("Failed to fetch metadata");
                                const metadata = await response.json();
                                return {
                                    ...nft,
                                    image: metadata.image || "",
                                    name: metadata.name || `NFT #${nft.tokenId.toString()}`,
                                    description: metadata.description || "No description",
                                    attributes: metadata.attributes || [],
                                };
                            } catch (error) {
                                console.error(`Failed to fetch NFT metadata: ${error}`);
                                return {
                                    ...nft,
                                    image: "",
                                    name: `NFT #${nft.tokenId.toString()}`,
                                    description: "No description",
                                    attributes: [],
                                };
                            }
                        })
                );

                setFavoriteNFTs(nftDetails);
                setIsLoading(false);
            } catch (error) {
                console.error("Failed to fetch favorites:", error);
                notification.error("获取收藏列表失败");
                setIsLoading(false);
            }
        };

        fetchFavorites();
    }, [address, allNFTs]);

    // 取消收藏
    const removeFavorite = async (tokenId: string) => {
        try {
            const response = await fetch('/api/favorites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tokenId,
                    userAddress: address,
                    action: 'remove'
                })
            });

            if (response.ok) {
                setFavoriteNFTs(prev => prev.filter(nft => nft.tokenId.toString() !== tokenId));
                notification.success("已取消收藏");
            }
        } catch (error) {
            notification.error("取消收藏失败");
        }
    };

    const textStyle = {
        color: '#C71585'
    };

    return (
        <div className="flex flex-col items-center pt-10 min-h-screen p-5">
            <style jsx>{`
                .favorite-card {
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

                .favorite-card::before {
                    content: '';
                    position: absolute;
                    inset: -1px;
                    z-index: -2;
                    background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
                        rgba(199, 21, 133, 0.8),
                        rgba(255, 182, 193, 0.8),
                        transparent 70%);
                    opacity: 0;
                    transition: opacity 0.4s;
                    border-radius: 20px;
                    filter: blur(8px);
                }

                .favorite-card:hover::before {
                    opacity: 0.5;
                }

                .favorite-card:hover {
                    transform: translateY(-10px);
                    box-shadow: 0 20px 40px rgba(199, 21, 133, 0.2);
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

                .favorite-card:hover .nft-image {
                    transform: scale(1.1);
                }

                .unfavorite-button {
                    background: linear-gradient(45deg, #C71585, #FFB6C1);
                    border: none;
                    padding: 12px 30px;
                    color: white;
                    border-radius: 50px;
                    transform: translateY(0);
                    transition: all 0.4s;
                    box-shadow: 0 5px 15px rgba(199, 21, 133, 0.4);
                    font-weight: bold;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    font-size: 0.85rem;
                    width: 100%;
                }

                .unfavorite-button:hover {
                    transform: translateY(-3px) scale(1.05);
                    box-shadow: 0 15px 30px rgba(199, 21, 133, 0.6);
                }

                .token-id-tag {
                    position: absolute;
                    bottom: 10px;
                    left: 10px;
                    background: rgba(199, 21, 133, 0.9);
                    padding: 8px 16px;
                    border-radius: 20px;
                    color: white;
                    font-weight: bold;
                    backdrop-filter: blur(5px);
                }
            `}</style>

            <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-[#C71585] to-[#FFB6C1] text-transparent bg-clip-text">
                我的收藏
            </h1>

            {!address ? (
                <div className="text-center">
                    <p className="mb-4" style={textStyle}>请先连接钱包查看收藏</p>
                    <RainbowKitCustomConnectButton />
                </div>
            ) : isLoading ? (
                <div className="flex justify-center items-center min-h-[200px]">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#C71585]"></div>
                </div>
            ) : favoriteNFTs.length === 0 ? (
                <div className="text-center text-[#C71585]">暂无收藏的NFT</div>
            ) : (
                <div className="flex flex-wrap justify-center gap-6 p-4">
                    {favoriteNFTs.map((nft) => (
                        <div 
                            key={nft.tokenId.toString()} 
                            className="favorite-card"
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
                                <div className="token-id-tag">
                                    #{nft.tokenId.toString()}
                                </div>
                            </div>

                            <div className="p-4 space-y-4">
                                <h2 className="text-xl font-bold text-white text-center">{nft.name}</h2>
                                <p className="text-gray-300">{nft.description}</p>

                                {nft.attributes && nft.attributes.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-[#C71585] font-semibold">标签:</span>
                                        {nft.attributes
                                            .filter(attr => attr.trait_type === "Tag")
                                            .map((attr, index) => (
                                                <span
                                                    key={index}
                                                    className="px-3 py-1 rounded-full text-sm bg-[#C71585] text-white"
                                                >
                                                    {attr.value}
                                                </span>
                                            ))
                                        }
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-gray-300">
                                        <span>价格:</span>
                                        <span>{(Number(nft.price) / 1e18).toFixed(4)} ETH</span>
                                    </div>
                                    <div className="flex items-center justify-between text-gray-300">
                                        <span>Owner:</span>
                                        <Address address={nft.seller} />
                                    </div>
                                </div>

                                <button
                                    onClick={() => removeFavorite(nft.tokenId.toString())}
                                    className="unfavorite-button"
                                >
                                    取消收藏
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FavoritePage;
