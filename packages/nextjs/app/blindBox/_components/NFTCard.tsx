import { useState, useEffect } from "react";
import { Collectible } from "./MyHoldings";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";  
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth"; 

export const NFTCard = ({ nft }: { nft: Collectible }) => {
  const [isListed, setIsListed] = useState(false); 

  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");

  return (
    <div className="card card-compact bg-base-100 shadow-lg w-[300px] shadow-secondary">
      <figure className="relative">
        <img src={nft.image} alt="NFT Image" className="h-60 min-w-full" />
        <figcaption className="glass absolute bottom-4 left-4 p-4 w-25 rounded-xl">
          <span className="text-white "># {nft.id}</span>
        </figcaption>
      </figure>

      <div className="card-body space-y-3">
        <div className="flex items-center justify-center">
          <p className="text-xl p-0 m-0 font-semibold">{nft.name}</p>
          <div className="flex flex-wrap space-x-2 mt-1">
            {nft.attributes?.map((attr, index) => (
              <span key={index} className="badge badge-primary py-3">
                {attr.value}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center mt-1">
          <p className="my-0 text-lg">{nft.description}</p>
        </div>

        <div className="flex space-x-3 mt-1 items-center">
          <span className="text-lg font-semibold">Owner : </span>
          <Address address={nft.owner} />
        </div>

        {/* 显示NFT的上架状态 */}
        <div className="flex space-x-3 mt-1 items-center">
          <span className="text-lg font-semibold">Listed: </span>
          <span className={`font-semibold ${isListed ? 'text-green-500' : 'text-red-500'}`}>
            {isListed ? "Yes" : "No"}
          </span>
        </div>

        {/* 分隔线 */}
        <div className="border-t my-3"></div>

        {/* 只显示NFT的发送功能 */}
        {isListed && (
          <div className="card-actions justify-end">
            <button
              className="btn btn-secondary btn-md px-8 tracking-wide"
              onClick={() => {
                try {
                  writeContractAsync({
                    functionName: "transferFrom",
                    args: [nft.owner, "receiverAddress", BigInt(nft.id.toString())], // receiverAddress 可根据实际情况替换
                  });
                } catch (err) {
                  console.error("Error calling transferFrom function");
                }
              }}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
