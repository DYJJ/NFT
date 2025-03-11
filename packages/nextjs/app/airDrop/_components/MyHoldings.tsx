"use client"; 
import { useEffect, useState } from "react";
import { NFTCard } from "./NFTCard";
import { useAccount } from "wagmi";
import { useScaffoldContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { getMetadataFromIPFS } from "~~/utils/simpleNFT/ipfs-fetch";
import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";
export interface Collectible extends Partial<NFTMetaData> {
  id: number;
  uri: string;
  owner: string;
}

// `MyHoldings` 组件用于展示用户所持有的NFT。
export const MyHoldings = () => {
  // 获取连接的钱包地址。
  const { address: connectedAddress } = useAccount();
  const [myAllCollectibles, setMyAllCollectibles] = useState<Collectible[]>([]);
  const [allCollectiblesLoading, setAllCollectiblesLoading] = useState(false);

  // 获取指定的 `YourCollectible` 合约实例。
  const { data: yourCollectibleContract } = useScaffoldContract({
    contractName: "YourCollectible",
  });

  // 获取连接地址所持有的 NFT 数量。
  const { data: myTotalBalance } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "balanceOf",
    args: [connectedAddress],
    watch: true, // 启用实时监听。
  });

  useEffect(() => {
    // 异步函数，用于更新用户的 NFT 列表。
    const updateMyCollectibles = async (): Promise<void> => {
      // 检查钱包地址、NFT 数量和合约实例是否有效。
      if (myTotalBalance === undefined || yourCollectibleContract === undefined || connectedAddress === undefined)
        return;

      setAllCollectiblesLoading(true); // 设置加载状态为 `true`，表示开始加载。

      const collectibleUpdate: Collectible[] = []; // 初始化一个空的收藏品数组。

      // 获取用户的 NFT 总数量。
      const totalBalance = parseInt(myTotalBalance.toString());

      // 循环遍历用户所持有的每个 NFT。
      for (let tokenIndex = 0; tokenIndex < totalBalance; tokenIndex++) {
        try {
          // 获取指定索引的 NFT 代币 ID。
          const tokenId = await yourCollectibleContract.read.tokenOfOwnerByIndex([
            connectedAddress,
            BigInt(tokenIndex),
          ]);

          // 获取 NFT 的 URI (元数据地址)。
          const tokenURI = await yourCollectibleContract.read.tokenURI([tokenId]);

          // 从 IPFS 获取 NFT 元数据。
          const nftMetadata: NFTMetaData = await getMetadataFromIPFS(tokenURI as string);

          // 将该 NFT 信息加入到更新列表。
          collectibleUpdate.push({
            id: parseInt(tokenId.toString()),
            uri: tokenURI,
            owner: connectedAddress,
            ...nftMetadata, // 合并 IPFS 返回的元数据。
          });
        } catch (e) {
          // 如果发生错误，显示错误通知并停止加载状态。
          notification.error("Error fetching all collectibles");
          setAllCollectiblesLoading(false);
          console.log(e);
        }
      }

      // 根据 NFT 的 ID 进行升序排列。
      collectibleUpdate.sort((a, b) => a.id - b.id);

      // 更新组件状态，保存所有收藏品的列表。
      setMyAllCollectibles(collectibleUpdate);
      setAllCollectiblesLoading(false); // 停止加载状态。
    };

    updateMyCollectibles(); // 调用更新函数。
  }, [connectedAddress, myTotalBalance]); // 依赖连接地址和 NFT 总数的变化。

  // 如果收藏品数据正在加载，显示加载指示器。
  if (allCollectiblesLoading)
    return (
      <div className="flex justify-center items-center mt-10">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  return (
    <>
      {myAllCollectibles.length === 0 ? (
        <div className="flex justify-center items-center mt-10">
          <div className="text-2xl text-primary-content">No NFTs found</div>
        </div>
      ) : (
        // 如果找到 NFT，展示 NFT 卡片。
        <div className="flex flex-wrap gap-4 my-8 px-5 justify-center">
          {myAllCollectibles.map(item => (
            // 使用 `NFTCard` 组件展示每个 NFT，按 ID 作为唯一键。
            <NFTCard nft={item} key={item.id} />
          ))}
        </div>
      )}
    </>
  );
};
