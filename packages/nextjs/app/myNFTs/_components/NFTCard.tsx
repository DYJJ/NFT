import { useState, useEffect } from "react";
import { Collectible } from "./MyHoldings";
import { Address, AddressInput } from "~~/components/scaffold-eth";
import { useScaffoldContract, useScaffoldEventHistory, useScaffoldWriteContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useAccount } from 'wagmi';
import { notification } from "~~/utils/scaffold-eth";

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

  // 拍卖相关的状态
  const [startPrice, setStartPrice] = useState<string>(""); // 拍卖起始价格
  const [minIncrement, setMinIncrement] = useState<string>(""); // 最小加价
  const [duration, setDuration] = useState<string>(""); // 拍卖持续时间
  const [isAuctionCreated, setIsAuctionCreated] = useState(false); // 竞拍是否创建状态

  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");
  const [rentalPrice, setRentalPrice] = useState("");
  const [rentalEndDate, setRentalEndDate] = useState(""); // 改为日期时间字符串
  const [rentalInfo, setRentalInfo] = useState<{
    owner: string;
    renter: string;
    price: bigint;
    endTime: bigint;
    isRented: boolean;
  } | null>(null);

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

  const { data: allRentals, isLoading: isRentalLoading } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "getAllRentals",
    args: [],
  });

  // 添加新的状态来追踪租赁结束处理
  const [isProcessingRentalEnd, setIsProcessingRentalEnd] = useState(false);

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
      // 如果 NFT 已经上架，则执行下架操作
      if (isListed) {
        await writeContractAsync({
          functionName: "delistNFT",
          args: [BigInt(nft.id)],
        });
        
        // 清除本地存储的过期时间
        localStorage.removeItem(`expiryDate-${nft.id}`);
        
        // 更新状态
        setIsListed(false);
        setExpiryDate("");
        setRemainingTime("");
        
        notification.success("NFT 已成功下架");
        return;
      }

      // 以下是上架逻辑
      if (!listingPrice || !expiryDate) {
        notification.error("请输入价格和截止时间");
        return;
      }

      const mintEvent = mintEvents?.find(event => event.args.tokenId === BigInt(nft.id));
      const royaltyReceiver = mintEvent ? mintEvent.args.royaltyReceiver : "";

      if (royaltyReceiver !== currentAddress) {
        const adjustedRoyalty = (Number(royaltyFee) * 1e14).toFixed(2);
        const userConfirmed = window.confirm(`版税金额为: ${adjustedRoyalty} ETH，您是否确认继续？`);
        if (!userConfirmed) return;
      }

      // 设置截止时间
      const expiryTimestamp = new Date(expiryDate).getTime() / 1000;
      const priceInWei = BigInt(Number(listingPrice) * 10 ** 18);

      // 保存上架价格到数据库
      if (nft.name) {
        await saveNFTPriceToDB(nft.name, listingPrice);
      }

      // 调用合约进行上架
      await writeContractAsync({
        functionName: "listNFT",
        args: [BigInt(nft.id), priceInWei, BigInt(expiryTimestamp)],
      });

      // 保存截止时间到 localStorage
      localStorage.setItem(`expiryDate-${nft.id}`, expiryDate);
      
      // 更新状态
      setIsListed(true);
      setListingPrice("");
      setExpiryDate("");
      
      notification.success("NFT 已成功上架");
    } catch (err) {
      console.error("NFT 上架/下架操作失败", err);
      notification.error("操作失败，请检查输入或合约状态");
    }
  };

  // 创建拍卖
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

  // 提前结束拍卖
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

  useEffect(() => {
    const fetchRentalInfo = async () => {
      if (!allRentals) return;
      
      // 在所有租赁中找到当前 NFT 的租赁信息
      const currentNFTRental = allRentals.find(
        (rental: any) => rental.tokenId.toString() === nft.id.toString()
      );
      
      if (currentNFTRental) {
        setRentalInfo({
          owner: currentNFTRental.owner,
          renter: currentNFTRental.renter,
          price: currentNFTRental.price,
          endTime: currentNFTRental.endTime,
          isRented: currentNFTRental.isRented
        });
      }
    };

    fetchRentalInfo();
  }, [allRentals, nft.id]);

  const handleRentOut = async () => {
    if (!rentalPrice || !rentalEndDate) {
      alert("请输入租赁价格和截止时间");
      return;
    }

    try {
      // 首先授权给合约
      if (!isApproved) {
        await writeContractAsync({
          functionName: "approve",
          args: [contractAddress, BigInt(nft.id)],
        });
      }

      const priceInWei = BigInt(Number(rentalPrice) * 10 ** 18);
      // 计算从现在到租赁结束时间的秒数
      const endTimestamp = Math.floor(new Date(rentalEndDate).getTime() / 1000);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const duration = BigInt(endTimestamp - currentTimestamp);

      if (duration <= 0n) {
        notification.error("租赁结束时间必须大于当前时间");
        return;
      }

      await writeContractAsync({
        functionName: "rentOut",
        args: [BigInt(nft.id), priceInWei, duration],
      });
      
      notification.success("NFT 已成功发布租赁");
      setRentalPrice("");
      setRentalEndDate("");
    } catch (error) {
      console.error("发布租赁时出错", error);
      notification.error("发布租赁失败");
    }
  };

  const handleRent = async () => {
    if (!rentalInfo) return;
    
    try {
      await writeContractAsync({
        functionName: "rent",
        args: [BigInt(nft.id)],
        value: rentalInfo.price,
      });
      notification.success("NFT 租用成功");
      
      // 更新租赁信息
      const updatedRental = allRentals?.find(
        (rental: any) => rental.tokenId.toString() === nft.id.toString()
      );
      if (updatedRental) {
        setRentalInfo({
          owner: updatedRental.owner,
          renter: updatedRental.renter,
          price: updatedRental.price,
          endTime: updatedRental.endTime,
          isRented: updatedRental.isRented
        });
      }
    } catch (error) {
      console.error("租用NFT时出错", error);
      notification.error("租用失败");
    }
  };

  // 正常结束拍卖
  const handleEndAuction = async () => {
    try {
      await writeContractAsync({
        functionName: "endAuction",
        args: [BigInt(nft.id)],
      });
      notification.success("竞拍已成功结束");
    } catch (err) {
      console.error("调用 endAuction 时出错", err);
      notification.error("结束竞拍失败，请确保竞拍时间已到");
    }
  };

  // 修改租赁检查定时器的 useEffect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkRentalStatus = async () => {
      if (rentalInfo && rentalInfo.isRented && !isProcessingRentalEnd) {
        const currentTime = Math.floor(Date.now() / 1000);
        const endTime = Number(rentalInfo.endTime);
        
        if (currentTime >= endTime) {
          try {
            setIsProcessingRentalEnd(true); // 开始处理租赁结束
            
            await writeContractAsync({
              functionName: "endRental",
              args: [BigInt(nft.id)],
            });
            
            notification.success("租赁已自动结束");
            
            // 更新租赁信息
            const updatedRental = allRentals?.find(
              (rental: any) => rental.tokenId.toString() === nft.id.toString()
            );
            if (updatedRental) {
              setRentalInfo({
                owner: updatedRental.owner,
                renter: updatedRental.renter,
                price: updatedRental.price,
                endTime: updatedRental.endTime,
                isRented: updatedRental.isRented
              });
            }

            // 清除定时器
            if (intervalId) {
              clearInterval(intervalId);
            }
          } catch (error) {
            console.error("自动结束租赁时出错", error);
            setIsProcessingRentalEnd(false); // 处理失败时重置状态
          }
        }
      }
    };

    if (rentalInfo?.isRented && !isProcessingRentalEnd) {
      // 每分钟检查一次租赁状态
      intervalId = setInterval(checkRentalStatus, 60000);
      // 立即执行一次检查
      checkRentalStatus();
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [rentalInfo, nft.id, writeContractAsync, allRentals, isProcessingRentalEnd]);

  // 在租赁状态更新时重置处理状态
  useEffect(() => {
    if (!rentalInfo?.isRented) {
      setIsProcessingRentalEnd(false);
    }
  }, [rentalInfo?.isRented]);

  // 添加显示租赁剩余时间的功能
  const [rentalRemainingTime, setRentalRemainingTime] = useState<string>("");

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const updateRentalRemainingTime = () => {
      if (rentalInfo?.isRented) {
        const currentTime = Math.floor(Date.now() / 1000);
        const endTime = Number(rentalInfo.endTime);
        const remainingSeconds = endTime - currentTime;

        if (remainingSeconds <= 0) {
          setRentalRemainingTime("已到期");
          return;
        }

        const days = Math.floor(remainingSeconds / 86400);
        const hours = Math.floor((remainingSeconds % 86400) / 3600);
        const minutes = Math.floor((remainingSeconds % 3600) / 60);
        const seconds = remainingSeconds % 60;

        setRentalRemainingTime(
          `${days}天 ${hours}小时 ${minutes}分钟 ${seconds}秒`
        );
      }
    };

    if (rentalInfo?.isRented) {
      intervalId = setInterval(updateRentalRemainingTime, 1000);
      updateRentalRemainingTime();
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [rentalInfo]);

  return (
    <>
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
          margin: 5px 0;
        }

        .action-button:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 15px 30px rgba(255, 99, 71, 0.6);
        }

        .input-field {
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 99, 71, 0.3);
          border-radius: 25px;
          padding: 10px 20px;
          color: white;
          transition: all 0.3s;
          width: 100%;
          margin: 5px 0;
        }

        .input-field:focus {
          border-color: #FF6347;
          box-shadow: 0 0 15px rgba(255, 99, 71, 0.3);
          outline: none;
        }

        .status-badge {
          background: linear-gradient(45deg, #FF6347, #FFB6C1);
          padding: 8px 16px;
          border-radius: 20px;
          color: white;
          font-weight: bold;
          display: inline-block;
          margin: 5px 0;
        }

        .info-container {
          padding: 15px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 15px;
          margin: 10px 0;
        }
      `}</style>

      <div 
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
          <img src={nft.image} alt={nft.name} className="nft-image" />
        </div>

        <div className="p-4 space-y-4">
          <h2 className="text-xl font-bold text-white">{nft.name}</h2>
          
          <div className="info-container">
            <div className="flex space-x-3 items-center">
              <span className="text-lg font-semibold text-white">Owner: </span>
              <Address address={nft.owner} />
            </div>

            {latestFragmentedEvent && (
              <div className="flex space-x-3 items-center mt-2">
                <span className="text-lg font-semibold text-white">Total Fragments: </span>
                <span className="status-badge">
                  {latestFragmentedEvent.args.totalFragments.toString()}
                </span>
              </div>
            )}

            {isListed && remainingTime && (
              <div className="flex space-x-3 items-center mt-2">
                <span className="text-lg font-semibold text-white">Remaining Time: </span>
                <span className="status-badge">{remainingTime}</span>
              </div>
            )}
          </div>

          {!isApproved && (
            <button
              onClick={handleApprove}
              className="action-button"
            >
              授权给合约
            </button>
          )}

          <div className="space-y-3">
            {!isListed && (
              <>
                <input
                  type="number"
                  placeholder="Price (ETH)"
                  value={listingPrice}
                  onChange={e => setListingPrice(e.target.value)}
                  className="input-field"
                />
                
                <input
                  type="datetime-local"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  className="input-field"
                />
              </>
            )}

            <button
              onClick={handleListClick}
              className="action-button"
            >
              {isListed ? "下架 NFT" : "上架 NFT"}
            </button>
          </div>

          {/* 拍卖相关表单 */}
          {!isAuctionCreated && (
            <div className="space-y-3">
              <input
                type="number"
                placeholder="Start Price (ETH)"
                value={startPrice}
                onChange={e => setStartPrice(e.target.value)}
                className="input-field"
              />
              
              <input
                type="number"
                placeholder="Min Increment (ETH)"
                value={minIncrement}
                onChange={e => setMinIncrement(e.target.value)}
                className="input-field"
              />
              
              <input
                type="number"
                placeholder="Duration (Seconds)"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="input-field"
              />

              <button
                onClick={handleCreateAuction}
                className="action-button"
              >
                发起拍卖
              </button>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleEndAuctionEarly}
              className="action-button"
            >
              提前结束竞拍
            </button>

            <button
              onClick={handleEndAuction}
              className="action-button"
            >
              结束竞拍
            </button>
          </div>

          {/* 碎片化相关表单 */}
          <div className="space-y-3">
            <input
              type="number"
              placeholder="碎片数量"
              value={fragmentCount}
              onChange={e => setFragmentCount(e.target.value)}
              className="input-field"
            />

            <button
              onClick={handleFragmentNFT}
              className="action-button"
            >
              碎片化 NFT
            </button>

            <input
              type="number"
              placeholder="碎片价格 (ETH)"
              value={fragmentListingPrice}
              onChange={e => setFragmentListingPrice(e.target.value)}
              className="input-field"
            />

            <button
              onClick={handleListFragments}
              className="action-button"
            >
              上架碎片
            </button>
          </div>

          {/* 租赁相关表单和信息 */}
          <div className="divider">租赁功能</div>

          {rentalInfo && (
            <div className="info-container">
              <div className="flex space-x-3 items-center">
                <span className="text-lg font-semibold text-white">租赁状态: </span>
                <span className="status-badge">
                  {rentalInfo.isRented ? "已出租" : "未出租"}
                </span>
              </div>
              
              {rentalInfo.isRented && (
                <>
                  <div className="flex space-x-3 items-center mt-2">
                    <span className="text-lg font-semibold text-white">租用者: </span>
                    <Address address={rentalInfo.renter} />
                  </div>
                  <div className="flex space-x-3 items-center mt-2">
                    <span className="text-lg font-semibold text-white">剩余时间: </span>
                    <span className="status-badge">
                      {rentalRemainingTime}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {!rentalInfo?.isRented && nft.owner === currentAddress && (
            <div className="space-y-3">
              <input
                type="number"
                placeholder="租赁价格 (ETH)"
                value={rentalPrice}
                onChange={e => setRentalPrice(e.target.value)}
                className="input-field"
              />
              
              <input
                type="datetime-local"
                placeholder="租赁截止时间"
                value={rentalEndDate}
                onChange={e => setRentalEndDate(e.target.value)}
                className="input-field"
              />

              <button
                onClick={handleRentOut}
                className="action-button"
              >
                发布租赁
              </button>
            </div>
          )}

          {!rentalInfo?.isRented && nft.owner !== currentAddress && rentalInfo?.price && (
            <button
              onClick={handleRent}
              className="action-button"
            >
              租用 NFT ({Number(rentalInfo.price) / 10 ** 18} ETH)
            </button>
          )}
        </div>
      </div>
    </>
  );
};
