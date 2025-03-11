"use client";

import type { NextPage } from "next";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";
import { useAccount } from 'wagmi'; // 引入 useAccount hook

const TransactionHistory: NextPage = () => {
  const { address: currentAddress } = useAccount(); // 获取当前连接的账户地址
  const { data: transferEvents, isLoading: loadingTransfers } = useScaffoldEventHistory({
    contractName: "YourCollectible",
    eventName: "Transfer",
    fromBlock: 0n,
  });

  const { data: purchaseEvents, isLoading: loadingPurchases } = useScaffoldEventHistory({
    contractName: "YourCollectible",
    eventName: "Purchase",
    fromBlock: 0n,
  });

  if (loadingTransfers || loadingPurchases)
    return (
      <div className="flex justify-center items-center mt-10">
        <span className="loading loading-spinner loading-xl"></span>
      </div>
    );

  // 计算符合条件的总版税金额
  const totalRoyalty = purchaseEvents?.reduce((total, event) => {
    if (event.args.royaltyReceiver === currentAddress && !event.args.isFirstSale) {
      return total + (parseFloat(event.args.royaltyAmount.toString()) / 1e18);
    }
    return total;
  }, 0) || 0;

  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10">
        <div className="px-5 mt-10">
          <h2 className="text-center mb-8">
            <span className="block text-4xl font-bold" style={{ color: '#C71585' }}>My Royalty Earnings</span>
          </h2>
          <h3 className="text-center text-xl mb-4" style={{ color: '#C71585' }}>
            Total Royalty Earnings: {totalRoyalty.toFixed(4)} ETH
          </h3>
        </div>
        <div className="overflow-x-auto shadow-lg">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th className="text-red-500" style={{ backgroundColor: '#FFE1FF' }}>Token Id</th>
                <th className="text-red-500" style={{ backgroundColor: '#FFE1FF' }}>Seller</th>
                <th className="text-red-500" style={{ backgroundColor: '#FFE1FF' }}>Buyer</th>
                <th className="text-red-500" style={{ backgroundColor: '#FFE1FF' }}>Price (ETH)</th>
                <th className="text-red-500" style={{ backgroundColor: '#FFE1FF' }}>Royalty Amount (ETH)</th>
                <th className="text-red-500" style={{ backgroundColor: '#FFE1FF' }}>Purchase Time</th>
              </tr>
            </thead>
            <tbody>
              {!purchaseEvents || purchaseEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center" style={{ color: '#C71585' }}>
                    No purchase events found
                  </td>
                </tr>
              ) : (
                purchaseEvents
                  .filter(event => 
                    event.args.royaltyReceiver === currentAddress && 
                    !event.args.isFirstSale 
                  )
                  .map((event, index) => (
                      <tr key={index} style={{ color: '#C71585' }}>
                        <th className="text-center">{event.args.tokenId?.toString()}</th>
                        <td>
                          <Address address={event.args.seller} />
                        </td>
                        <td>
                          <Address address={event.args.buyer} />
                        </td>
                        <td className="text-center">
                          {event.args.price ? (parseFloat(event.args.price.toString()) / 1e18).toFixed(4) : 'N/A'}
                        </td>
                        <td className="text-center">
                          {event.args.royaltyAmount ? (parseFloat(event.args.royaltyAmount.toString()) / 1e18).toFixed(4) : 'N/A'}
                        </td>
                        <td className="text-center">
                          {event.args.purchaseTime ? new Date(Number(event.args.purchaseTime) * 1000).toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default TransactionHistory;
