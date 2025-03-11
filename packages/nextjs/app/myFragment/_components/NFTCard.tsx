import { useState, useEffect } from "react";
import { Collectible } from "./MyHoldings";
import { Address, AddressInput } from "~~/components/scaffold-eth";
import { useScaffoldContract, useScaffoldEventHistory, useScaffoldWriteContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useAccount } from 'wagmi';

// 在 fetchFromApi 中加入详细的错误处理
const fetchFromApi = async ({ path, method, body }: { path: string; method: string; body?: object }) => {
  try {
    const response = await fetch(path, {
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

// 保存 NFT 数据到数据库
const saveNFTPriceToDB = (nftName: string, price: string) => {
  console.log("Saving NFT price to DB:", nftName, price); // 调试信息
  return fetchFromApi({
    path: '/api/list',
    method: 'POST',
    body: { name: nftName, price }, // 传递 name 和 price
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
  const [startPrice, setStartPrice] = useState<string>(""); // 拍卖起始价格
  const [minIncrement, setMinIncrement] = useState<string>(""); // 最小加价
  const [duration, setDuration] = useState<string>(""); // 拍卖持续时间
  const [isAuctionCreated, setIsAuctionCreated] = useState(false); // 竞拍是否创建状态
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

  const handleListClick = async () => {
    try {
      const mintEvent = mintEvents?.find(event => event.args.tokenId === BigInt(nft.id));
      const royaltyReceiver = mintEvent ? mintEvent.args.royaltyReceiver : "";

      if (royaltyReceiver !== currentAddress) {
        const adjustedRoyalty = (Number(royaltyFee) * 1e14).toFixed(2);
        const userConfirmed = window.confirm(`版税金额为: ${adjustedRoyalty} ETH，您是否确认继续？`);
        if (!userConfirmed) return;
      }

      // 设置截止时间
      const expiryTimestamp = new Date(expiryDate).getTime() / 1000; // 转换为 UNIX 时间戳
      console.log(`NFT 上架截止时间: ${expiryDate}`); // 打印到控制台

      const priceInWei = BigInt(Number(listingPrice) * 10 ** 18);
      console.log(nft);  // 打印 nft 对象，确认它的结构

      // 保存上架价格到数据库，使用 name 而不是 id
      await saveNFTPriceToDB(nft.name, listingPrice);  // 使用 name 来保存价格

      // 调用合约进行上架
      await writeContractAsync({
        functionName: "listNFT",
        args: [BigInt(nft.id.toString()), priceInWei, expiryTimestamp], // 仍然使用 id 来调用合约
      });

      // 保存截止时间到 localStorage
      localStorage.setItem(`expiryDate-${nft.id}`, expiryDate);
      setListingPrice("");
      setExpiryDate(""); // 清空截止时间输入
    } catch (err) {
      console.error("调用 listNFT 函数时出错", err);
    }
  };

  const handleCreateAuction = async () => {
    try {
      const startPriceInWei = BigInt(Number(startPrice) * 10 ** 18);
      const minIncrementInWei = BigInt(Number(minIncrement) * 10 ** 18);
      const auctionDuration = BigInt(Number(duration));

      await writeContractAsync({
        functionName: "createAuction",
        args: [BigInt(nft.id), startPriceInWei, minIncrementInWei, auctionDuration],
      });

      alert(`成功发起拍卖，起始价格: ${startPrice} ETH, 最小加价: ${minIncrement} ETH, 持续时间: ${duration} 秒`);
      setStartPrice("");
      setMinIncrement("");
      setDuration("");
      setIsAuctionCreated(true); // 更新竞拍已创建状态
    } catch (err) {
      console.error("调用 createAuction 方法时出错", err);
      alert("发起拍卖失败，请检查输入值或合约状态");
    }
  };

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

  const handleApprove = async () => {
    if (!contractAddress) {
      alert("合约地址无效，请检查合约部署情况。");
      return;
    }

    try {
      await writeContractAsync({
        functionName: "approve",
        args: [contractAddress, BigInt(nft.id)], // 授权给合约
      });
      setIsApproved(true); // 授权成功后更新状态
      alert(`成功授权合约: ${contractAddress} 以处理 NFT: ${nft.id}`);
    } catch (err) {
      console.error("调用 approve 函数时出错", err);
    }
  };

  const handleEndAuctionEarly = async () => {
    try {
      await writeContractAsync({
        functionName: "endAuctionEarly",
        args: [BigInt(nft.id)],  // 使用 nft.id 作为参数
      });
      alert("竞拍已提前结束");
    } catch (err) {
      console.error("调用 endAuctionEarly 时出错", err);
      alert("提前结束竞拍失败");
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

  // 添加处理碎片上架的函数
  const handleListFragments = async () => {
    if (!contractAddress) {
      alert("合约地址无效，请检查合约部署情况。");
      return;
    }

    try {
      await writeContractAsync({
        functionName: "listFragments",
        args: [BigInt(nft.id), BigInt(Number(fragmentListingPrice) * 10 ** 18)], // 将价格转换为Wei
      });
      alert(`NFT ID ${nft.id} 的碎片已成功上架，价格为 ${fragmentListingPrice} ETH。`);
      setFragmentListingPrice(""); // 清空输入
    } catch (err) {
      console.error("调用 listFragments 函数时出错", err);
      alert("上架碎片失败，请检查输入值或合约状态");
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

        {!isApproved && (
          <button
            onClick={handleApprove}
            className="btn btn-primary mt-3 w-[200px] h-[100px] mx-auto whitespace-nowrap text-green-400 [text-shadow:_0_0_5px_#4ade80] hover:text-green-300"
          >
            授权给合约
          </button>
        )}

        <div className="flex flex-col">
          <label htmlFor="listingPrice" className="font-semibold">Price (ETH):</label>
          <input
            id="listingPrice"
            type="number"
            placeholder="价格"
            value={listingPrice}
            onChange={e => setListingPrice(e.target.value)}
            className="input input-bordered w-full my-2"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="expiryDate" className="font-semibold">Listing Expiry:</label>
          <input
            id="expiryDate"
            type="datetime-local"
            value={expiryDate}
            onChange={e => setExpiryDate(e.target.value)}
            className="input input-bordered w-full my-2"
          />
        </div>

        <button
          onClick={handleListClick}
          className="btn btn-primary mt-3 w-[200px] mx-auto whitespace-nowrap text-green-400 [text-shadow:_0_0_5px_#4ade80] hover:text-green-300"
        >
          {isListed ? "取消上架" : "上架"}
        </button>


        {/* 如果竞拍未创建，显示拍卖输入框 */}
        {!isAuctionCreated && (
          <>
            <div className="flex flex-col">
              <label htmlFor="startPrice" className="font-semibold">Start Price (ETH):</label>
              <input
                id="startPrice"
                type="number"
                placeholder="起始价格"
                value={startPrice}
                onChange={e => setStartPrice(e.target.value)}
                className="input input-bordered w-full my-2"
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="minIncrement" className="font-semibold">Min Increment (ETH):</label>
              <input
                id="minIncrement"
                type="number"
                placeholder="最小加价"
                value={minIncrement}
                onChange={e => setMinIncrement(e.target.value)}
                className="input input-bordered w-full my-2"
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="duration" className="font-semibold">Duration (Seconds):</label>
              <input
                id="duration"
                type="number"
                placeholder="持续时间 (秒)"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="input input-bordered w-full my-2"
              />
            </div>

            <button
              onClick={handleCreateAuction}
              className="btn btn-primary mt-3 w-[200px] h-[100px] mx-auto whitespace-nowrap text-green-400 [text-shadow:_0_0_5px_#4ade80] hover:text-green-300"
            >
              发起拍卖
            </button>
          </>
        )}

<button 
  onClick={handleEndAuctionEarly} 
  className="btn btn-danger mt-3 w-[200px] h-[100px] mx-auto whitespace-nowrap text-green-400 [text-shadow:_0_0_5px_#4ade80] hover:text-green-300"
>
  提前结束竞拍
</button>

        <div className="flex flex-col">
          <label htmlFor="fragmentCount" className="font-semibold">碎片数量:</label>
          <input
            id="fragmentCount"
            type="number"
            placeholder="输入碎片数量"
            value={fragmentCount}
            onChange={e => setFragmentCount(e.target.value)}
            className="input input-bordered w-full my-2"
          />
        </div>

        <button
          onClick={handleFragmentNFT}
          className="btn btn-primary mt-3 w-[200px] h-[100px] mx-auto whitespace-nowrap text-green-400 [text-shadow:_0_0_5px_#4ade80] hover:text-green-300"
        >
          碎片化 NFT
        </button>

        <div className="flex flex-col">
          <label htmlFor="fragmentListingPrice" className="font-semibold">碎片价格 (ETH):</label>
          <input
            id="fragmentListingPrice"
            type="number"
            placeholder="输入碎片价格"
            value={fragmentListingPrice}
            onChange={e => setFragmentListingPrice(e.target.value)}
            className="input input-bordered w-full my-2"
          />
        </div>

        <button
          onClick={handleListFragments}
          className="btn btn-primary mt-3 w-[200px] h-[100px] mx-auto whitespace-nowrap text-green-400 [text-shadow:_0_0_5px_#4ade80] hover:text-green-300"
        >
          上架碎片
        </button>

      </div>
    </div>
  );
};
