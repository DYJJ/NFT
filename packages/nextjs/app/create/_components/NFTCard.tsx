import { useState } from "react";
// 导入 React 的 useState hook，用于管理组件内部的状态。

import { Collectible } from "./MyHoldings";
// 导入 Collectible 类型，用于定义 NFT 数据的结构。

import { Address, AddressInput } from "~~/components/scaffold-eth";
// 导入 Address 和 AddressInput 组件，分别用于显示和输入以太坊地址。

import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
// 导入自定义 hook，用于与合约进行写操作。

// `NFTCard` 组件用于展示单个 NFT 以及实现其转让功能。
export const NFTCard = ({ nft }: { nft: Collectible }) => {
  // 定义一个状态，用于存储用户输入的目标地址。
  const [transferToAddress, setTransferToAddress] = useState("");

  // 从 `useScaffoldWriteContract` 中获取 `writeContractAsync` 函数，用于执行合约写操作。
  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");

  return (
    // 卡片组件，展示 NFT 信息以及转移功能按钮。
    <div className="card card-compact backdrop-blur-md 
    bg-rose-300/60 dark:bg-rose-800/60 
    hover:bg-rose-300/70 dark:hover:bg-rose-800/70 
    border border-rose-200/40 dark:border-rose-700/40 
    shadow-xl hover:shadow-2xl transition-all duration-300 
    rounded-2xl w-[300px]">
      <figure className="relative">
        {/* 显示 NFT 的图片 */}
        <img src={nft.image} alt="NFT Image" className="h-60 min-w-full" />
        
        {/* 图片的描述，包括显示 NFT 的 ID */}
        <figcaption className="glass absolute bottom-4 left-4 p-4 w-25 rounded-xl">
          <span className="text-white "># {nft.id}</span>
        </figcaption>
      </figure>

      {/* 卡片主体部分，展示 NFT 详细信息 */}
      <div className="card-body space-y-3">
        
        {/* 显示 NFT 名称和属性 */}
        <div className="flex items-center justify-center">
          <p className="text-xl p-0 m-0 font-semibold">{nft.name}</p>
          <div className="flex flex-wrap space-x-2 mt-1">
            {/* 遍历并显示每个属性 */}
            {nft.attributes?.map((attr, index) => (
              <span key={index} className="badge badge-primary py-3">
                {attr.value}
              </span>
            ))}
          </div>
        </div>

        {/* 显示 NFT 的描述 */}
        <div className="flex flex-col justify-center mt-1">
          <p className="my-0 text-lg">{nft.description}</p>
        </div>

        {/* 显示 NFT 所有者的地址 */}
        <div className="flex space-x-3 mt-1 items-center">
          <span className="text-lg font-semibold">Owner : </span>
          <Address address={nft.owner} />
        </div>

        {/* 输入框，用于输入 NFT 接收者的地址 */}
        <div className="flex flex-col my-2 space-y-1">
          <span className="text-lg font-semibold mb-1">Transfer To: </span>
          <AddressInput
            value={transferToAddress}
            placeholder="receiver address"
            onChange={newValue => setTransferToAddress(newValue)}
          />
        </div>

        {/* 按钮，用于执行 NFT 的转移操作 */}
        <div className="card-actions justify-end">
          <button
            className="btn btn-secondary btn-md px-8 tracking-wide"
            onClick={() => {
              try {
                // 调用合约的 `transferFrom` 方法，将 NFT 转移给指定地址。
                writeContractAsync({
                  functionName: "transferFrom",
                  args: [nft.owner, transferToAddress, BigInt(nft.id.toString())],
                });
              } catch (err) {
                console.error("Error calling transferFrom function");
              }
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
