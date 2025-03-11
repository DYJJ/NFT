import { useState, useEffect } from "react";
import { Collectible } from "./MyHoldings";
import { Address, AddressInput } from "~~/components/scaffold-eth";
import { useScaffoldContract, useScaffoldEventHistory, useScaffoldWriteContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useAccount } from 'wagmi';

// 修改 fetchFromApi 方法以支持不同的 API 路径和方法
const fetchFromApi = async ({ path, method, body }: { path: string; method: string; body?: object }) => {
  try {
    const response = await fetch(`/api/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('API Error:', error);
      return error;
    }

    return response.json();
  } catch (error) {
    console.error("Error in API call:", error);
    return { error: 'Request failed' };
  }
};

// 修改 saveNFTPriceToDB 方法以调用 POST 方法添加空投地址
const saveAirdropAddressToDB = (nftName: string, price: string, airdropAddress: string) => {
  console.log("Saving NFT price and airdrop address to DB:", nftName, price, airdropAddress);
  return fetchFromApi({
    path: 'airdrop/route',
    method: 'POST',
    body: { name: nftName, price, addresses: [airdropAddress] }, // 传递 name, price 和 addresses
  });
};

export const NFTCard = ({ nft }: { nft: Collectible }) => {
  const [transferToAddress, setTransferToAddress] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [isListed, setIsListed] = useState(false);
  const [royaltyFee, setRoyaltyFee] = useState<number | null>(null);
  const [isApproved, setIsApproved] = useState(false); // 新增状态
  const [expiryDate, setExpiryDate] = useState<string>(""); // 新增状态：截止时间
  const [remainingTime, setRemainingTime] = useState<string>(""); // 新增状态：剩余时间
  const { address: currentAddress } = useAccount();
  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");

  // 获取合约地址
  const { data: yourCollectibleContract } = useScaffoldContract({
    contractName: "YourCollectible",
  });

  const contractAddress = yourCollectibleContract?.address; // 自动获取合约地址

  const { data: mintEvents, isLoading: loadingMint } = useScaffoldEventHistory({
    contractName: "YourCollectible",
    eventName: "Mint",
    fromBlock: 0n,
  });

  const { data: royaltyEvents } = useScaffoldEventHistory({
    contractName: "YourCollectible",
    eventName: "RoyaltySet",
    fromBlock: 0n,
  });

  const { data: auctionDetails } = useScaffoldContract({
    contractName: "YourCollectible",
    functionName: "getAuctionDetails",
    args: [BigInt(nft.id)],  // 获取当前 NFT 的竞拍信息
  });

  const { data: fragmentedEvents } = useScaffoldEventHistory({
    contractName: "YourCollectible",
    eventName: "NFTFragmented",
    fromBlock: 0n,
  });

  const latestFragmentedEvent = fragmentedEvents?.find(event => event.args.tokenId === BigInt(nft.id));

  // 使用 useScaffoldReadContract 钩子获取碎片拥有数量
  const { data: fragmentOwnershipCount, isLoading: isLoadingFragmentCount } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "getFragmentOwnershipCount",
    args: [BigInt(nft.id), currentAddress],
  });

  // 在文件中添加状态来存储碎片数量
  const [fragmentCount, setFragmentCount] = useState("");

  // 在文件中添加状态来存储碎片上架价格
  const [fragmentListingPrice, setFragmentListingPrice] = useState("");

  useEffect(() => {
    const fetchIsListed = async () => {
      try {
        const listed = await yourCollectibleContract.read.isNFTListed([BigInt(nft.id)]);
        setIsListed(listed);
        if (listed) {
          const storedExpiryDate = localStorage.getItem(`expiryDate-${nft.id}`);
          if (storedExpiryDate) {
            setExpiryDate(storedExpiryDate);
            //calculateRemainingTime(storedExpiryDate);
          }
        }
      } catch (err) {
        //console.error("获取 NFT 上架状态时出错", err);
      }
    };

    const checkApprovalStatus = async () => {
      if (!contractAddress) return;
      try {
        const approvedAddress = await yourCollectibleContract.read.getApproved([BigInt(nft.id)]);
        setIsApproved(approvedAddress.toLowerCase() === contractAddress.toLowerCase());
      } catch (err) {
        console.error("获取授权状态时出错", err);
      }
    };

    fetchIsListed();
    checkApprovalStatus(); // 检查授权状态
  }, [nft.id, yourCollectibleContract]);

  useEffect(() => {
    if (royaltyEvents && royaltyEvents.length > 0) {
      const latestRoyaltyEvent = royaltyEvents[royaltyEvents.length - 1];
      setRoyaltyFee(parseFloat(latestRoyaltyEvent.args.feeNumerator.toString()) / 1e18);
    }
  }, [royaltyEvents]);

  useEffect(() => {
    if (latestFragmentedEvent) {
      console.log(`Total Fragments for NFT ID ${nft.id}:`, latestFragmentedEvent.args.totalFragments);
    }
  }, [latestFragmentedEvent, nft.id]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const calculateRemainingTime = (expiryDate: string) => {
      const expiryTimestamp = new Date(expiryDate).getTime();
      const currentTimestamp = Date.now();
      const remainingMilliseconds = expiryTimestamp - currentTimestamp;

      if (remainingMilliseconds > 0) {
        const hours = Math.floor(remainingMilliseconds / 3600000);
        const minutes = Math.floor((remainingMilliseconds % 3600000) / 60000);
        const seconds = Math.floor((remainingMilliseconds % 60000) / 1000);
        setRemainingTime(`${hours}小时 ${minutes}分钟 ${seconds}秒`);
      } else {
        setRemainingTime("已过期");
        setIsListed(false); // 设置为下架状态
        clearInterval(intervalId); // 停止定时器
        delistNFT(); // 调用 delistNFT 方法下架 NFT
      }
    };

    if (expiryDate) {
      intervalId = setInterval(() => calculateRemainingTime(expiryDate), 1000);
    }

    return () => clearInterval(intervalId); // 清理定时器
  }, [expiryDate]);

  const delistNFT = async () => {
    try {
      await writeContractAsync({
        functionName: "delistNFT",
        args: [BigInt(nft.id)], // 传递 NFT ID 来下架
      });
      console.log(`NFT ${nft.id} 已成功下架`);
    } catch (err) {
      console.error("调用 delistNFT 函数时出错", err);
    }
  };

  // 在 useEffect 中打印碎片数量
  useEffect(() => {
    if (!isLoadingFragmentCount && fragmentOwnershipCount !== undefined) {
      //console.log(`用户 ${currentAddress} 拥有的 NFT ID ${nft.id} 的碎片数量:`, fragmentOwnershipCount);
    }
  }, [fragmentOwnershipCount, isLoadingFragmentCount, currentAddress, nft.id]);

  // 添加处理碎片化的函数
  const handleFragmentNFT = async () => {
    if (!contractAddress) {
      alert("合约地址无效，请检查合约部署情况。");
      return;
    }

    try {
      await writeContractAsync({
        functionName: "fragmentNFT",
        args: [BigInt(nft.id), Number(fragmentCount)],
      });
      alert(`NFT ID ${nft.id} 已成功碎片化为 ${fragmentCount} 个碎片。`);
      setFragmentCount(""); // 清空输入
    } catch (err) {
      console.error("调用 fragmentNFT 函数时出错", err);
      alert("碎片化失败，请检查输入值或合约状态");
    }
  };

  return (
    <div className="card card-compact backdrop-blur-md 
    bg-rose-300/60 dark:bg-rose-800/60 
    hover:bg-rose-300/70 dark:hover:bg-rose-800/70 
    border border-rose-200/40 dark:border-rose-700/40 
    shadow-xl hover:shadow-2xl transition-all duration-300 
    rounded-2xl w-[300px]">
      <figure className="relative">
        <img src={nft.image} alt="NFT Image" className="h-60 min-w-full" />
        <figcaption className="glass absolute bottom-4 left-4 p-4 w-25 rounded-xl">
          <span className="text-white"># {nft.id}</span>
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
          <span className="text-lg font-semibold">Owner: </span>
          <Address address={nft.owner} />
        </div>

        {latestFragmentedEvent && (
          <div className="flex space-x-3 mt-1 items-center">
            <span className="text-lg font-semibold">Total Fragments: </span>
            <span className="font-semibold text-blue-500">{latestFragmentedEvent.args.totalFragments.toString()}</span>
          </div>
        )}

        {isListed && remainingTime && (
          <div className="flex space-x-3 mt-1 items-center">
            <span className="text-lg font-semibold">剩余时间: </span>
            <span className="font-semibold text-blue-500">{remainingTime}</span>
          </div>
        )}

        <div className="flex space-x-3 mt-1 items-center">
          <span className="text-lg font-semibold">Listed: </span>
          <span className={`font-semibold ${isListed ? 'text-green-500' : 'text-red-500'}`}>
            {isListed ? "是" : "否"}
          </span>
        </div>

        <div className="flex space-x-3 mt-1 items-center">
          <span className="text-lg font-semibold">授权状态: </span>
          <span className={`font-semibold ${isApproved ? 'text-green-500' : 'text-red-500'}`}>
            {isApproved ? "已授权" : "未授权"}
          </span>
        </div>

      </div>
    </div>
  );
};
