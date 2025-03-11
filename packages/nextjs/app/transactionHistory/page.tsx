"use client";

import type { NextPage } from "next";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const TransactionHistory: NextPage = () => {
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

  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10 px-4">
        <div className="px-5 mt-10">
          <h2 className="text-center mb-8">
            <span className="block text-4xl font-bold" style={{ color: '#C71585' }}>All Purchase Events</span>
          </h2>
        </div>
        <div className="overflow-x-auto shadow-lg rounded-2xl backdrop-blur-md 
        bg-rose-300/60 dark:bg-rose-800/60 
        border border-rose-200/40 dark:border-rose-700/40 
        shadow-xl transition-all duration-300 
        w-full max-w-7xl">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="bg-rose-400/50 dark:bg-rose-900/50 text-black font-bold">Token Id</th>
                <th className="bg-rose-400/50 dark:bg-rose-900/50 text-black font-bold">Seller</th>
                <th className="bg-rose-400/50 dark:bg-rose-900/50 text-black font-bold">Buyer</th>
                <th className="bg-rose-400/50 dark:bg-rose-900/50 text-black font-bold">Price (ETH)</th>
                <th className="bg-rose-400/50 dark:bg-rose-900/50 text-black font-bold">Purchase Time</th>
              </tr>
            </thead>
            <tbody>
              {!purchaseEvents || purchaseEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-red-500">
                    No purchase events found
                  </td>
                </tr>
              ) : (
                purchaseEvents.map((event, index) => (
                  <tr key={index} className="bg-rose-200/30 dark:bg-rose-700/30 hover:bg-rose-300/40 dark:hover:bg-rose-600/40">
                    <th className="text-center text-black">{event.args.tokenId?.toString()}</th>
                    <td>
                      <Address address={event.args.seller} />
                    </td>
                    <td>
                      <Address address={event.args.buyer} />
                    </td>
                    <td className="text-center text-black">
                      {event.args.price ? (parseFloat(event.args.price.toString()) / 1e18).toFixed(4) : 'N/A'}
                    </td>
                    <td className="text-center text-black">
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
