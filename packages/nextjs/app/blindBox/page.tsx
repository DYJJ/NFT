"use client";

import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { useEffect, useState } from "react";

const BlindBoxPurchase: NextPage = () => {
    const { address } = useAccount();
    const [blindBoxes, setBlindBoxes] = useState<readonly { tokenIds: readonly bigint[]; isSold: boolean; price: bigint; }[]>([]);

    const { data, isError, isLoading } = useScaffoldReadContract({
        contractName: "YourCollectible",
        functionName: "getBlindBoxes",
        args: undefined,
    });

    const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");

    useEffect(() => {
        if (data) {
            setBlindBoxes([...data]);
        }

        if (isError) {
            notification.error("获取盲盒列表失败");
        }
    }, [data, isError]);

    const getRandomNftId = (tokenIds: readonly bigint[]) => {
        const randomIndex = Math.floor(Math.random() * tokenIds.length);
        return tokenIds[randomIndex];
    };

    const handleBuyBlindBox = async (boxIndex: number, price: bigint, tokenIds: readonly bigint[]) => {
        try {
            const randomNftId = getRandomNftId(tokenIds);
            await writeContractAsync({
                functionName: "buyBlindBox",
                args: [BigInt(boxIndex + 1), randomNftId],
                value: price,
            });
            notification.success("购买盲盒成功！");
        } catch (error) {
            console.error("购买盲盒失败:", error);
            notification.error("购买盲盒失败");
        }
    };

    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        const box = event.currentTarget;
        const rect = box.getBoundingClientRect();
        
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        
        box.style.setProperty('--mouse-x', `${x}%`);
        box.style.setProperty('--mouse-y', `${y}%`);

        createParticles(event);
    };

    const createParticles = (event: React.MouseEvent<HTMLDivElement>) => {
        const box = event.currentTarget;
        const rect = box.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        for (let i = 0; i < 5; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            const tx = (Math.random() - 0.5) * 100;
            const ty = (Math.random() - 0.5) * 100;
            
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
            particle.style.setProperty('--tx', `${tx}px`);
            particle.style.setProperty('--ty', `${ty}px`);
            
            box.appendChild(particle);
            
            particle.style.animation = `particle 1s ease-out forwards`;
            setTimeout(() => particle.remove(), 1000);
        }
    };

    const LoadingSpinner = () => (
        <div className="flex justify-center items-center min-h-[200px]">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
        </div>
    );

    return (
        <>
            <style jsx>{`
                .perspective-1000 {
                    perspective: 1000px;
                    margin: 20px;
                }

                .mystery-box-container {
                    width: 280px;
                    height: 420px;
                    position: relative;
                    padding: 20px;
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    overflow: hidden;
                    position: relative;
                    isolation: isolate;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    transform-style: preserve-3d;
                }

                .mystery-box-container::before {
                    content: '';
                    position: absolute;
                    inset: -1px;
                    z-index: -2;
                    background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
                        rgba(122, 63, 234, 0.8),
                        rgba(63, 234, 215, 0.8),
                        transparent 70%);
                    opacity: 0;
                    transition: opacity 0.4s;
                    border-radius: 20px;
                    filter: blur(8px);
                }

                .mystery-box-container:hover::before {
                    opacity: 0.5;
                }

                .mystery-box-container::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    z-index: -1;
                    opacity: 0;
                    transition: opacity 0.4s;
                    background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
                        rgba(255, 255, 255, 0.1) 0%,
                        rgba(255, 255, 255, 0.05) 20%,
                        transparent 40%);
                }

                .mystery-box-container:hover::after {
                    opacity: 1;
                }

                .mystery-box {
                    width: 150px;
                    height: 150px;
                    position: relative;
                    transform-style: preserve-3d;
                    transition: transform 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    margin: 30px auto 40px;
                    animation: float 6s ease-in-out infinite;
                }

                .mystery-box-container:hover .mystery-box {
                    transform: rotateY(720deg) rotateX(45deg) scale(1.1);
                }

                .box-face {
                    position: absolute;
                    width: 150px;
                    height: 150px;
                    background: linear-gradient(45deg, #FF416C, #FF4B2B, #7A3FEA, #3FEAD7);
                    background-size: 400% 400%;
                    animation: gradient 8s ease infinite;
                    border: 2px solid rgba(255, 255, 255, 0.5);
                    box-shadow: inset 0 0 30px rgba(255, 255, 255, 0.5);
                    transition: all 0.3s ease;
                }

                .mystery-box-container:hover .box-face {
                    box-shadow: inset 0 0 50px rgba(255, 255, 255, 0.8),
                               0 0 30px rgba(122, 63, 234, 0.6);
                    background-size: 200% 200%;
                }

                .box-front { 
                    transform: translateZ(75px);
                    border-radius: 12px;
                }
                .box-back { 
                    transform: translateZ(-75px) rotateY(180deg);
                    border-radius: 12px;
                }
                .box-top { 
                    transform: rotateX(90deg) translateZ(75px);
                    border-radius: 12px;
                }
                .box-bottom { 
                    transform: rotateX(-90deg) translateZ(75px);
                    border-radius: 12px;
                }
                .box-left { 
                    transform: rotateY(-90deg) translateZ(75px);
                    border-radius: 12px;
                }
                .box-right { 
                    transform: rotateY(90deg) translateZ(75px);
                    border-radius: 12px;
                }

                .box-number {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 2rem;
                    font-weight: bold;
                    color: white;
                    text-shadow: 0 0 20px rgba(255,255,255,0.8);
                    animation: glow 2s ease-in-out infinite alternate;
                }

                .card-body {
                    width: 100%;
                    padding: 15px;
                    text-align: center;
                    margin-top: 20px;
                }

                .card-body p {
                    margin: 15px 0;
                }

                .btn-3d {
                    background: linear-gradient(45deg, #7A3FEA, #3FEAD7);
                    border: none;
                    padding: 12px 30px;
                    color: white;
                    border-radius: 50px;
                    transform: translateY(0);
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    box-shadow: 0 5px 15px rgba(122, 63, 234, 0.4);
                    font-weight: bold;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    font-size: 0.85rem;
                    margin-top: 10px;
                    position: relative;
                    overflow: hidden;
                }

                .btn-3d::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(
                        circle,
                        rgba(255, 255, 255, 0.3) 0%,
                        transparent 70%
                    );
                    transform: rotate(0deg);
                    transition: all 0.5s ease;
                    opacity: 0;
                }

                .btn-3d:hover {
                    transform: translateY(-5px) scale(1.05);
                    box-shadow: 0 15px 30px rgba(122, 63, 234, 0.6);
                }

                .btn-3d:hover::before {
                    opacity: 1;
                    transform: rotate(180deg);
                }

                .btn-3d:disabled {
                    background: linear-gradient(45deg, #cccccc, #999999);
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                @keyframes float {
                    0% { transform: translateY(0px) rotateY(0deg); }
                    50% { transform: translateY(-20px) rotateY(180deg) scale(1.05); }
                    100% { transform: translateY(0px) rotateY(360deg); }
                }

                @keyframes gradient {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }

                @keyframes glow {
                    from {
                        text-shadow: 0 0 10px rgba(255,255,255,0.8),
                                   0 0 20px rgba(255,255,255,0.8),
                                   0 0 30px rgba(255,255,255,0.8);
                    }
                    to {
                        text-shadow: 0 0 20px rgba(255,255,255,0.8),
                                   0 0 30px rgba(255,255,255,0.8),
                                   0 0 40px rgba(255,255,255,0.8);
                    }
                }

                @keyframes particle {
                    0% {
                        transform: translate(0, 0) scale(1);
                        opacity: 0;
                    }
                    50% {
                        opacity: 1;
                    }
                    100% {
                        transform: translate(var(--tx), var(--ty)) scale(0);
                        opacity: 0;
                    }
                }

                .particle {
                    position: absolute;
                    width: 4px;
                    height: 4px;
                    background: white;
                    border-radius: 50%;
                    pointer-events: none;
                }

                .mystery-box-container:hover {
                    transform: translateY(-10px);
                    box-shadow: 0 20px 40px rgba(122, 63, 234, 0.2);
                }

                .glow-effect {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    background: radial-gradient(
                        circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
                        rgba(122, 63, 234, 0.4),
                        transparent 40%
                    );
                    opacity: 0;
                    transition: opacity 0.3s;
                    pointer-events: none;
                }

                .mystery-box-container:hover .glow-effect {
                    opacity: 1;
                }

                @keyframes boxOpen {
                    0% { transform: scale(1) rotateY(0); }
                    50% { transform: scale(1.1) rotateY(180deg); }
                    100% { transform: scale(1) rotateY(360deg); }
                }

                .mystery-box.opening {
                    animation: boxOpen 1.5s ease-in-out;
                }

                .price-tag {
                    background: linear-gradient(45deg, #7A3FEA, #3FEAD7);
                    padding: 8px 16px;
                    border-radius: 20px;
                    color: white;
                    font-weight: bold;
                    transform: translateY(0);
                    transition: all 0.3s;
                }

                .price-tag:hover {
                    transform: translateY(-2px) scale(1.05);
                    box-shadow: 0 5px 15px rgba(122, 63, 234, 0.3);
                }
            `}</style>

            <div>
                <RainbowKitCustomConnectButton />


                {isLoading ? (
                    <LoadingSpinner />
                ) : (
                    <div className="flex flex-wrap justify-center gap-4">
                        {blindBoxes.map((box, index) => (
                            <div 
                                key={`box-${index}`} 
                                className="mystery-box-container perspective-1000"
                                onMouseMove={handleMouseMove}
                            >
                                <div className="glow-effect"></div>
                                <div className="mystery-box">
                                    <div className="box-face box-front">
                                        <span className="box-number">NFT盲盒</span>
                                    </div>
                                    <div className="box-face box-back"></div>
                                    <div className="box-face box-top"></div>
                                    <div className="box-face box-bottom"></div>
                                    <div className="box-face box-left"></div>
                                    <div className="box-face box-right"></div>
                                </div>
                                
                                <div className="card-body space-y-3">
                                    <p className="text-xl font-bold text-gradient bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-cyan-500">
                                        神秘盲盒 #{index + 1}
                                    </p>
                                    <div className="price-tag">
                                        <span className="mr-1">💎</span>
                                        {box.price ? (Number(box.price) / 1e18).toFixed(4) : '未知'} ETH
                                    </div>
                                    
                                    {!box.isSold && (
                                        <div className="flex justify-center">
                                            <button
                                                className="btn-3d group"
                                                onClick={() => handleBuyBlindBox(index, box.price, box.tokenIds)}
                                                disabled={!address || box.isSold}
                                            >
                                                <span className="flex items-center">
                                                    <span className="mr-2">🎁</span>
                                                    {!address ? "请先连接钱包" : "立即购买"}
                                                    <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                                                </span>
                                            </button>
                                        </div>
                                    )}
                                    
                                    {box.isSold && (
                                        <div className="text-center text-red-500 font-bold mt-2">
                                            <span className="mr-2">🔒</span>已售罄
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

export default BlindBoxPurchase;

