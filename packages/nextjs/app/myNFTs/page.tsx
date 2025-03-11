"use client";

import { MyHoldings } from "./_components";
import type { NextPage } from "next"; 
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth"; 
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth"; 
import { addToIPFS } from "~~/utils/simpleNFT/ipfs-fetch"; 
import nftsMetadata from "~~/utils/simpleNFT/nftsMetadata";
import { useState, useEffect } from "react";

const MyNFTs: NextPage = () => {
  const { address: connectedAddress, isConnected, isConnecting } = useAccount();
  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");

  return (
    <>
      <div className="flex items-center flex-col pt-10">
        <div className="px-5">
          <h1 className="text-center mb-8">
            <span className="block text-4xl font-bold text-[#C71585]">我的NFT</span>
          </h1>
        </div>
      </div>

      <MyHoldings />
    </>
  );
};

export default MyNFTs;
