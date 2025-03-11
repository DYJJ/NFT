"use client";

// 导入所需的组件和工具
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldEventHistory, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { useEffect, useState } from "react";
import { Address } from "~~/components/scaffold-eth";

// NFT 列表组件
const NFTListings: NextPage = () => {
    const { address } = useAccount();
    const [nftListings, setNftListings] = useState<any[]>([]);
    const [countdownTimers, setCountdownTimers] = useState<{ [key: string]: number }>({});
    const [bidAmounts, setBidAmounts] = useState<{ [key: string]: string }>({});
    const [withdrawableAmounts, setWithdrawableAmounts] = useState<{ [key: string]: string }>({}); // 用来存储可提取的金额

    const { data, isError, isLoading } = useScaffoldReadContract({
        contractName: "YourCollectible",
        functionName: "getListedNFTs",
        args: [],
    });

    const { data: auctionCreatedEvents, isLoading: loadingAuctionCreated } = useScaffoldEventHistory({
        contractName: "YourCollectible",
        eventName: "AuctionCreated",
        fromBlock: 0n,
    });

    const { data: newBidEvents, isLoading: loadingNewBid } = useScaffoldEventHistory({
        contractName: "YourCollectible",
        eventName: "NewBid",
        fromBlock: 0n,
    });

    const { data: auctionEndedEvents, isLoading: loadingAuctionEnded } = useScaffoldEventHistory({
        contractName: "YourCollectible",
        eventName: "AuctionEnded",
        fromBlock: 0n,
    });

    // 获取 NFT 数据和拍卖事件
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
                            };
                        } catch (error) {
                            console.error(`获取 NFT 元数据失败: ${error}`);
                            return {
                                ...nft,
                                image: "",
                                name: `NFT #${nft.tokenId.toString()}`,
                                description: "无描述",
                            };
                        }
                    })
                );
                setNftListings(nftData);
            };

            fetchMetadata();
        }

        if (isError) {
            notification.error("获取 NFT 列表失败");
        }
    }, [data, isError]);

    // 计算倒计时
    const formatCountdown = (milliseconds: number) => {
        const hours = Math.floor(milliseconds / 3600000); // 1小时 = 3600000毫秒
        const minutes = Math.floor((milliseconds % 3600000) / 60000); // 1分钟 = 60000毫秒
        const seconds = Math.floor((milliseconds % 60000) / 1000); // 1秒 = 1000毫秒
        return `${hours}小时${minutes}分钟${seconds}秒`;
    };

    // 4. 竞拍操作
    const handleBid = async (tokenId: string) => {
        try {
            const bidAmountInWei = BigInt(Number(bidAmounts[tokenId]) * 10 ** 18);
            // 调用合约竞拍方法
            await writeContractAsync({
                functionName: "bid",
                args: [BigInt(tokenId)],
                value: bidAmountInWei,
            });

            notification.success(`成功竞拍，金额: ${bidAmounts[tokenId]} ETH`);
            setBidAmounts(prev => ({ ...prev, [tokenId]: "" })); // 清空输入框
        } catch (error) {
            console.error("竞拍失败", error);
            notification.error("竞拍失败，请检查金额或合约状态");
        }
    };

    // 5. 提现操作
    const handleWithdraw = async (tokenId: string) => {
        try {
            await writeContractAsync({
                functionName: "withdraw",
                args: [BigInt(tokenId)],
            });

            notification.success(`成功提现: ${withdrawableAmounts[tokenId]} ETH`);
            setWithdrawableAmounts(prev => ({ ...prev, [tokenId]: "" })); // 清空可提现金额
        } catch (error) {
            console.error("提现失败", error);
            notification.error("提现失败，请稍后重试");
        }
    };

    useEffect(() => {
        const updateCountdown = () => {
            const newTimers: { [key: string]: number } = {};
            nftListings.forEach((nft) => {
                const auctionCreatedEvent = auctionCreatedEvents?.find((event: any) => event.args.tokenId.toString() === nft.tokenId.toString());
                if (auctionCreatedEvent) {
                    const endTime = Number(auctionCreatedEvent.args.endTime) * 1000; // 转换为毫秒
                    const remainingTime = endTime - Date.now();
                    if (remainingTime > 0) {
                        newTimers[nft.tokenId] = remainingTime;
                    } else {
                        newTimers[nft.tokenId] = 0;
                    }
                }
            });

            setCountdownTimers(newTimers);
        };

        // 每秒更新倒计时
        const interval = setInterval(updateCountdown, 1000);

        // 清理定时器
        return () => clearInterval(interval);
    }, [nftListings, auctionCreatedEvents]);

    const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");

    // 渲染加载中的内容
    if (loadingAuctionCreated || loadingNewBid || loadingAuctionEnded) {
        return <div>加载中...</div>;
    }

    // 获取某个 NFT 的相关事件
    const getEventDataByTokenId = (tokenId: string) => {
        const auctionCreatedEvent = auctionCreatedEvents?.find((event: any) => event.args.tokenId.toString() === tokenId);
        const newBidEvent = newBidEvents?.find((event: any) => event.args.tokenId.toString() === tokenId);
        const auctionEndedEvent = auctionEndedEvents?.find((event: any) => event.args.tokenId.toString() === tokenId);

        // 判断拍卖是否已结束
        const isAuctionEnded = auctionEndedEvent || 
            (auctionCreatedEvent && Number(auctionCreatedEvent.args.endTime) * 1000 < Date.now());

        return { auctionCreatedEvent, newBidEvent, auctionEndedEvent, isAuctionEnded };
    };

    return (
        <div>
            <style jsx>{`
                .auction-card {
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

                .auction-card::before {
                    content: '';
                    position: absolute;
                    inset: -1px;
                    z-index: -2;
                    background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
                        rgba(255, 215, 0, 0.8),  /* 金色 */
                        rgba(218, 165, 32, 0.8), /* 金菊色 */
                        transparent 70%);
                    opacity: 0;
                    transition: opacity 0.4s;
                    border-radius: 20px;
                    filter: blur(8px);
                }

                .auction-card:hover::before {
                    opacity: 0.5;
                }

                .auction-card:hover {
                    transform: translateY(-10px) rotateX(5deg);
                    box-shadow: 0 20px 40px rgba(255, 215, 0, 0.2);
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

                .auction-card:hover .nft-image {
                    transform: scale(1.1);
                }

                .auction-timer {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: linear-gradient(45deg, #FFD700, #DAA520);
                    padding: 8px 16px;
                    border-radius: 20px;
                    color: white;
                    font-weight: bold;
                    backdrop-filter: blur(5px);
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }

                .bid-input {
                    background: rgba(255, 255, 255, 0.1);
                    border: 2px solid rgba(255, 215, 0, 0.3);
                    border-radius: 25px;
                    padding: 10px 20px;
                    color: white;
                    transition: all 0.3s;
                    width: 100%;
                    margin-bottom: 10px;
                }

                .bid-input:focus {
                    border-color: #FFD700;
                    box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
                    outline: none;
                }

                .bid-button {
                    background: linear-gradient(45deg, #FFD700, #DAA520);
                    border: none;
                    padding: 12px 30px;
                    color: white;
                    border-radius: 50px;
                    transform: translateY(0);
                    transition: all 0.4s;
                    box-shadow: 0 5px 15px rgba(255, 215, 0, 0.4);
                    font-weight: bold;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    font-size: 0.85rem;
                    width: 100%;
                    margin-top: 10px;
                }

                .bid-button:hover:not(:disabled) {
                    transform: translateY(-3px) scale(1.05);
                    box-shadow: 0 15px 30px rgba(255, 215, 0, 0.6);
                }

                .bid-button:disabled {
                    background: #cccccc;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                .current-bid {
                    background: linear-gradient(45deg, #FFD700, #DAA520);
                    padding: 8px 16px;
                    border-radius: 20px;
                    color: white;
                    font-weight: bold;
                    display: inline-block;
                    margin-top: 10px;
                }

                .withdraw-button {
                    background: linear-gradient(45deg, #FF4500, #FF6347);
                    border: none;
                    padding: 12px 30px;
                    color: white;
                    border-radius: 50px;
                    transition: all 0.4s;
                    font-weight: bold;
                    letter-spacing: 1px;
                    width: 100%;
                    margin-top: 10px;
                }

                .withdraw-button:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 10px 20px rgba(255, 69, 0, 0.4);
                }
            `}</style>

            <RainbowKitCustomConnectButton />
            <h1 className="text-4xl text-center text-[#FFD700] mb-8">NFT 拍卖行</h1>

            {isLoading ? (
                <p>加载中...</p>
            ) : (
                <div className="flex flex-wrap justify-center gap-6">
                    {nftListings.map((nft) => {
                        const { auctionCreatedEvent, newBidEvent, isAuctionEnded } = getEventDataByTokenId(nft.tokenId.toString());
                        const countdownTime = countdownTimers[nft.tokenId] || 0;

                        return (
                            <div
                                key={nft.tokenId.toString()}
                                className="auction-card"
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
                                    {auctionCreatedEvent && !isAuctionEnded && (
                                        <div className="auction-timer">
                                            ⏰ {formatCountdown(countdownTime)}
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 space-y-4">
                                    <h2 className="text-xl font-bold text-white">{nft.name}</h2>
                                    <p className="text-gray-200">{nft.description}</p>

                                    <div className="text-sm text-gray-300">
                                        <div className="mb-2">
                                            <span className="font-semibold">拥有者: </span>
                                            <Address address={nft.seller} />
                                        </div>

                                        {auctionCreatedEvent && (
                                            <div className="space-y-2">
                                                <div className="current-bid">
                                                    💰 起拍价: {(Number(auctionCreatedEvent.args.startPrice) / 1e18).toFixed(4)} ETH
                                                </div>
                                                <div className="current-bid">
                                                    📈 最小加价: {(Number(auctionCreatedEvent.args.minIncrement) / 1e18).toFixed(4)} ETH
                                                </div>
                                            </div>
                                        )}

                                        {!isAuctionEnded && (
                                            <div className="mt-4">
                                                <input
                                                    type="number"
                                                    placeholder="输入竞拍金额 (ETH)"
                                                    value={bidAmounts[nft.tokenId] || ""}
                                                    onChange={e => setBidAmounts(prev => ({ ...prev, [nft.tokenId]: e.target.value }))}
                                                    className="bid-input"
                                                    step="0.001"
                                                />
                                                <button
                                                    onClick={() => handleBid(nft.tokenId)}
                                                    className="bid-button"
                                                    disabled={nft.seller.toLowerCase() === address?.toLowerCase() || isAuctionEnded}
                                                >
                                                    {nft.seller.toLowerCase() === address?.toLowerCase()
                                                        ? "您是卖家"
                                                        : "参与竞拍"}
                                                </button>
                                            </div>
                                        )}

                                        {address && newBidEvent && (
                                            <div className="mt-4">
                                                <button
                                                    onClick={() => handleWithdraw(nft.tokenId)}
                                                    className="withdraw-button"
                                                    disabled={newBidEvent.args.bidder.toLowerCase() === address.toLowerCase()}
                                                >
                                                    {newBidEvent.args.bidder.toLowerCase() === address.toLowerCase() 
                                                        ? "您是最高出价者"
                                                        : `提现 `}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default NFTListings;
