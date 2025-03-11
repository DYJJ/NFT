// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract YourCollectible is
	ERC721,
	ERC721Enumerable,
	ERC721URIStorage,
	Ownable,
	ERC2981,
	ReentrancyGuard
{
	using Counters for Counters.Counter;

	Counters.Counter public tokenIdCounter;

	struct NFTListing {
		uint256 tokenId;
		uint256 price;
		address seller;
		bool isListed;
		string tokenUri;
		address royaltyReceiver;
		uint96 royaltyPercentage;
		bool isFirstSale;
		uint256 listingEndTime;
		bool isFragmented;
	}

	struct Auction {
		uint256 tokenId;
		uint256 startPrice;
		uint256 minIncrement;
		uint256 endTime;
		address highestBidder;
		uint256 highestBid;
		bool isActive;
	}

	struct FragmentedNFT {
		uint256 tokenId;
		uint256 totalFragments;
		uint256 fragmentsAvailable;
		uint256 fragmentPrice;
		bool isListed;
		mapping(uint256 => address) fragmentOwners;
		mapping(address => uint256) ownershipCount;
		mapping(address => FragmentListing) fragmentListings;
	}

	struct FragmentListing {
		uint256 listedAmount;
		uint256 price;
		bool isListed;
	}

	struct BlindBox {
		uint256[] tokenIds;
		bool isSold;
		uint256 price;
	}

	struct RentalListing {
		address owner;
		address renter;
		uint256 price;
		uint256 endTime;
	}

	struct RentalDetails {
		uint256 tokenId;
		address owner;
		address renter;
		uint256 price;
		uint256 endTime;
		bool isRented;
		string tokenUri;
	}

	mapping(uint256 => NFTListing) public listings;

	NFTListing[] public listedNFTs;

	mapping(uint256 => Auction) public auctions;

	//存储被超越的出价人的金额
	mapping(uint256 => mapping(address => uint256)) public pendingReturns;

	mapping(uint256 => FragmentedNFT) public fragmentedNFTs;

	mapping(uint256 => BlindBox) public blindBoxes;
	uint256[] private blindBoxIndices;

	mapping(uint256 => RentalListing) public rentals;

	event AuctionCreated(
		uint256 indexed tokenId,
		uint256 startPrice,
		uint256 minIncrement,
		uint256 endTime
	);

	event NewBid(
		uint256 indexed tokenId,
		address indexed bidder,
		uint256 amount
	);

	event AuctionEnded(
		uint256 indexed tokenId,
		address indexed winner,
		uint256 amount
	);

	event Purchase(
		uint256 indexed tokenId,
		address indexed seller,
		address buyer,
		uint256 price,
		uint256 royaltyAmount,
		address indexed royaltyReceiver,
		uint256 purchaseTime,
		bool isFirstSale
	);

	event Mint(
		uint256 indexed tokenId,
		address indexed seller,
		address buyer,
		uint256 price,
		uint256 royaltyAmount,
		address indexed royaltyReceiver,
		uint256 purchaseTime,
		bool isFirstSale
	);

	event RoyaltySet(uint256 tokenId, address receiver, uint96 feeNumerator);

	event NFTFragmented(uint256 indexed tokenId, uint256 totalFragments);

	event FragmentPurchased(
		uint256 indexed tokenId,
		address indexed buyer,
		uint256 numFragments
	);

	event FragmentsListed(uint256 indexed tokenId, uint256 fragmentPrice);

	event FragmentRelisted(
		uint256 indexed tokenId,
		address indexed seller,
		uint256 amount,
		uint256 price
	);

	event FragmentSold(
		uint256 indexed tokenId,
		address indexed seller,
		address indexed buyer,
		uint256 amount,
		uint256 price
	);

	event NFTRented(
		uint256 indexed tokenId,
		address indexed owner,
		address indexed renter,
		uint256 price,
		uint256 endTime
	);

	// 在合约中添加一个状态变量来存储默克尔根
	string private merkleRoot;

	// 在合约中添加一个状态变量来记录已领取空投的地址
	mapping(address => bool) public airdropClaimed;

	// 添加一个事件，用于记录空投领取
	event AirdropClaimed(address indexed claimant, uint256 tokenId);

	// 在合约中添加一个映射来存储每个地址的Merkle证明
	mapping(address => bytes32[]) private merkleProofs;

	// 在合约中添加一个新的结构体来存储碎片详细信息
	struct FragmentDetails {
		uint256 tokenId;
		uint256 totalFragments;
		uint256 fragmentsAvailable;
		uint256 fragmentPrice;
		bool isListed;
		string tokenUri;
		uint256 ownershipCount;
		address[] fragmentOwners;
		uint256[] ownedFragmentIndices;
	}

	// 简化的碎片详情结构体
	struct SimpleFragmentDetails {
		string tokenUri; // NFT元数据（包含图片和名称）
		uint256 totalFragments; // 总碎片数量
		uint256 fragmentsAvailable; // 可用碎片数量
		uint256 ownedCount; // 拥有的碎片数量
		uint256 fragmentPrice; // 碎片价格
		bool isListed; // 是否在售
	}

	// 添加新的结构体用于返回完整的碎片上架信息
	struct FragmentListingDetails {
		uint256 listedAmount;
		uint256 price;
		bool isListed;
		string tokenUri; // NFT的元数据URI
		uint256 totalFragments; // 总碎片数量
		uint256 fragmentsAvailable; // 剩余可用碎片数量
		uint256 ownerTotalFragments; // 卖家拥有的总碎片数量
	}

	constructor() ERC721("YourCollectible", "YCB") {}

	function _baseURI() internal pure override returns (string memory) {
		return "https://amethyst-worrying-salmon-494.mypinata.cloud/ipfs/";
	}

	function mintItem(
		address to,
		string memory uri,
		address royaltyReceiver,
		uint96 feeNumerator
	) public returns (uint256) {
		tokenIdCounter.increment();
		uint256 tokenId = tokenIdCounter.current();
		_safeMint(to, tokenId);
		_setTokenURI(tokenId, uri);

		_setTokenRoyalty(tokenId, royaltyReceiver, feeNumerator);
		emit RoyaltySet(tokenId, royaltyReceiver, feeNumerator);

		listings[tokenId] = NFTListing({
			tokenId: tokenId,
			price: 0,
			seller: address(0),
			isListed: false,
			tokenUri: uri,
			royaltyReceiver: royaltyReceiver,
			royaltyPercentage: feeNumerator,
			isFirstSale: true,
			listingEndTime: 0,
			isFragmented: false
		});

		emit Mint(
			tokenId,
			address(0),
			to,
			0,
			0,
			royaltyReceiver,
			block.timestamp,
			true
		);

		return tokenId;
	}

	function mintBatch(
		address to,
		string[] memory uris,
		address[] memory royaltyReceivers,
		uint96[] memory royaltyPercentages
	) public returns (uint256) {
		uint256 quantity = uris.length;

		require(
			royaltyReceivers.length == quantity,
			"Royalty receivers length must be equal to URIs length"
		);
		require(
			royaltyPercentages.length == quantity,
			"Royalty percentages length must be equal to URIs length"
		);
		require(quantity <= 20, "Exceeded max batch size of 20");

		for (uint256 i = 0; i < quantity; i++) {
			// 调用 mintItem 方法铸造每个NFT，并为每个NFT传入独立的URI版税接收人和版税比例
			mintItem(to, uris[i], royaltyReceivers[i], royaltyPercentages[i]);
		}

		return tokenIdCounter.current();
	}

	function listNFT(
		uint256 tokenId,
		uint256 price,
		uint256 listingEndTime
	) public {
		require(ownerOf(tokenId) == msg.sender, "You are not the owner");
		require(price > 0, "Price must be greater than 0");
		require(
			listingEndTime > block.timestamp,
			"Listing end time must be in the future"
		);

		(address royaltyReceiver, uint256 royaltyAmount) = royaltyInfo(
			tokenId,
			price
		);

		listings[tokenId] = NFTListing({
			tokenId: tokenId,
			price: price,
			seller: msg.sender,
			isListed: true,
			tokenUri: tokenURI(tokenId),
			royaltyReceiver: royaltyReceiver,
			royaltyPercentage: uint96(royaltyAmount),
			isFirstSale: listings[tokenId].isFirstSale,
			listingEndTime: listingEndTime,
			isFragmented: false
		});

		listedNFTs.push(listings[tokenId]);
	}
	
	function delistNFT(uint256 tokenId) public {
		NFTListing storage listing = listings[tokenId];
		require(listing.isListed, "NFT is not listed for sale");
		require(
			listing.seller == msg.sender,
			"You are not the seller of this NFT"
		);

		listing.isListed = false;

		for (uint i = 0; i < listedNFTs.length; i++) {
			if (listedNFTs[i].tokenId == tokenId) {
				listedNFTs[i] = listedNFTs[listedNFTs.length - 1];
				listedNFTs.pop();
				break;
			}
		}

		emit NFTDelisted(tokenId, msg.sender, block.timestamp); // 触发下架事件
	}

	// 新增事件，用于触发NFT下架
	event NFTDelisted(
		uint256 indexed tokenId,
		address indexed seller,
		uint256 timestamp
	);

	function buyNFT(uint256 tokenId) public payable {
		NFTListing memory listing = listings[tokenId];
		require(listing.isListed, "NFT not listed for sale");
		require(msg.value >= listing.price, "Insufficient funds sent");
		require(
			listing.listingEndTime >= block.timestamp,
			"NFT listing has expired"
		);

		require(
			ownerOf(tokenId) == listing.seller,
			"Seller is not the owner of the NFT"
		);

		// 使用 ERC721 的 transferFrom 方法
		this.transferFrom(listing.seller, msg.sender, tokenId);

		uint256 royaltyAmount = 0;
		address royaltyReceiver;

		if (!listing.isFirstSale) {
			(royaltyReceiver, royaltyAmount) = royaltyInfo(tokenId, msg.value);
			payable(royaltyReceiver).transfer(royaltyAmount);
		} else {
			royaltyReceiver = listing.royaltyReceiver;
		}

		uint256 amountToSeller = msg.value - royaltyAmount;
		payable(listing.seller).transfer(amountToSeller);

		emit Purchase(
			tokenId,
			listing.seller,
			msg.sender,
			listing.price,
			royaltyAmount,
			royaltyReceiver,
			block.timestamp,
			listing.isFirstSale
		);

		listing.isListed = false;
		listing.isFirstSale = false;
		delete listings[tokenId];

		for (uint i = 0; i < listedNFTs.length; i++) {
			if (listedNFTs[i].tokenId == tokenId) {
				listedNFTs[i] = listedNFTs[listedNFTs.length - 1];
				listedNFTs.pop();
				break;
			}
		}
	}

	// 创建拍卖
	function createAuction(
		uint256 tokenId,
		uint256 startPrice,
		uint256 minIncrement,
		uint256 duration
	) public {
		require(ownerOf(tokenId) == msg.sender, "You are not the owner");
		require(!auctions[tokenId].isActive, "Auction already active");

		uint256 endTime = block.timestamp + duration;

		auctions[tokenId] = Auction({
			tokenId: tokenId,
			startPrice: startPrice,
			minIncrement: minIncrement,
			endTime: endTime,
			highestBidder: address(0),
			highestBid: 0,
			isActive: true
		});

		emit AuctionCreated(tokenId, startPrice, minIncrement, endTime);
	}

	// 参与竞拍
	function bid(uint256 tokenId) public payable {
		Auction storage auction = auctions[tokenId];
		require(auction.isActive, "Auction is not active");
		require(
			msg.value >= auction.startPrice,
			"Bid must be at least the start price"
		);
		require(
			msg.value >= auction.highestBid + auction.minIncrement,
			"Bid must be higher than the current bid + increment"
		);

		if (auction.highestBidder != address(0)) {
			// 记录需退还的资金
			pendingReturns[tokenId][auction.highestBidder] += auction
				.highestBid;
		}

		auction.highestBidder = msg.sender;
		auction.highestBid = msg.value;

		emit NewBid(tokenId, msg.sender, msg.value);
	}

	// 提取被超越的出价
	function withdraw(uint256 tokenId) public nonReentrant {
		uint256 amount = pendingReturns[tokenId][msg.sender];
		require(amount > 0, "No funds to withdraw");

		pendingReturns[tokenId][msg.sender] = 0;
		payable(msg.sender).transfer(amount);
	}

	function endAuction(uint256 tokenId) public {
		Auction storage auction = auctions[tokenId];
		require(auction.isActive, "Auction is not active");
		require(block.timestamp >= auction.endTime, "Auction not yet ended");

		auction.isActive = false;

		if (auction.highestBidder != address(0)) {
			// 转移 NFT 给最高出价者
			this.transferFrom(ownerOf(tokenId), auction.highestBidder, tokenId);
			
			// 转移竞拍金额给卖家
			payable(ownerOf(tokenId)).transfer(auction.highestBid);

			emit AuctionEnded(tokenId, auction.highestBidder, auction.highestBid);
		}
	}

	function endAuctionEarly(uint256 tokenId) public {
		Auction storage auction = auctions[tokenId];
		require(auction.isActive, "Auction is not active");
		require(ownerOf(tokenId) == msg.sender, "You are not the owner");
		require(block.timestamp < auction.endTime, "Auction already ended");

		auction.isActive = false;

		if (auction.highestBidder != address(0)) {
			// 转移 NFT 给当前的最高出价者
			this.transferFrom(msg.sender, auction.highestBidder, tokenId);

			payable(msg.sender).transfer(auction.highestBid);

			emit AuctionEnded(
				tokenId,
				auction.highestBidder,
				auction.highestBid
			);
		}
	}

	// 获取当前竞拍信息
	function getAuctionDetails(
		uint256 tokenId
	) public view returns (Auction memory) {
		return auctions[tokenId];
	}

	function getCurrentTimestamp() public view returns (uint256) {
		return block.timestamp;
	}

	function getListedNFTs() public view returns (NFTListing[] memory) {
		uint256 totalListedNFTs = listedNFTs.length;
		// 计算已上架的碎片化NFT数量
		uint256 fragmentedListedCount = 0;
		for (uint256 i = 1; i <= tokenIdCounter.current(); i++) {
			if (fragmentedNFTs[i].isListed) {
				fragmentedListedCount++;
			}
		}
		NFTListing[] memory allListedNFTs = new NFTListing[](
			totalListedNFTs + fragmentedListedCount
		);
		for (uint256 i = 0; i < totalListedNFTs; i++) {
			allListedNFTs[i] = listedNFTs[i];
		}
		uint256 currentIndex = totalListedNFTs;
		for (uint256 i = 1; i <= tokenIdCounter.current(); i++) {
			if (fragmentedNFTs[i].isListed) {
				NFTListing memory fragmentListing = NFTListing({
					tokenId: i,
					price: fragmentedNFTs[i].fragmentPrice,
					seller: ownerOf(i),
					isListed: true,
					tokenUri: tokenURI(i),
					royaltyReceiver: address(0),
					royaltyPercentage: 0,
					isFirstSale: false,
					listingEndTime: 0,
					isFragmented: true
				});
				allListedNFTs[currentIndex] = fragmentListing;
				currentIndex++;
			}
		}
		return allListedNFTs;
	}

	function isNFTListed(uint256 tokenId) public view returns (bool) {
		NFTListing memory listing = listings[tokenId];
		return listing.isListed;
	}

	function _beforeTokenTransfer(
		address from,
		address to,
		uint256 tokenId,
		uint256 quantity
	) internal override(ERC721, ERC721Enumerable) {
		super._beforeTokenTransfer(from, to, tokenId, quantity);
	}

	function _burn(
		uint256 tokenId
	) internal override(ERC721, ERC721URIStorage) {
		super._burn(tokenId);
	}

	function tokenURI(
		uint256 tokenId
	) public view override(ERC721, ERC721URIStorage) returns (string memory) {
		return super.tokenURI(tokenId);
	}

	function supportsInterface(
		bytes4 interfaceId
	)
		public
		view
		override(ERC721, ERC721Enumerable, ERC721URIStorage, ERC2981)
		returns (bool)
	{
		return super.supportsInterface(interfaceId);
	}

	function fragmentNFT(uint256 tokenId, uint256 totalFragments) public {
		require(
			ownerOf(tokenId) == msg.sender,
			"Only owner can fragment the NFT"
		);
		require(totalFragments > 1, "Total fragments must be greater than 1");

		FragmentedNFT storage fragment = fragmentedNFTs[tokenId];
		fragment.tokenId = tokenId;
		fragment.totalFragments = totalFragments;
		fragment.fragmentsAvailable = totalFragments;
		emit NFTFragmented(tokenId, totalFragments);
	}

	function buyFragment(uint256 tokenId, uint256 numFragments) public payable {
		FragmentedNFT storage fragment = fragmentedNFTs[tokenId];
		require(fragment.isListed, "Fragments are not listed for sale");
		require(
			fragment.fragmentsAvailable >= numFragments,
			"Not enough fragments available"
		);
		// 计算总价格
		uint256 totalPrice = fragment.fragmentPrice * numFragments;
		require(msg.value >= totalPrice, "Insufficient payment");

		uint256 fragmentsToAssign = numFragments;
		for (
			uint256 i = 0;
			i < fragment.totalFragments && fragmentsToAssign > 0;
			i++
		) {
			if (fragment.fragmentOwners[i] == address(0)) {
				fragment.fragmentOwners[i] = msg.sender;
				fragmentsToAssign--;
			}
		}

		fragment.fragmentsAvailable -= numFragments;
		fragment.ownershipCount[msg.sender] += numFragments;

		payable(ownerOf(tokenId)).transfer(msg.value);

		if (fragment.fragmentsAvailable == 0) {
			fragment.isListed = false;
			_transfer(ownerOf(tokenId), msg.sender, tokenId);
		}

		emit FragmentPurchased(tokenId, msg.sender, numFragments);
	}

	function listFragments(uint256 tokenId, uint256 fragmentPrice) public {
		require(
			ownerOf(tokenId) == msg.sender,
			"Only owner can list the fragments"
		);
		FragmentedNFT storage fragment = fragmentedNFTs[tokenId];
		require(!fragment.isListed, "Fragments already listed");
		require(fragmentPrice > 0, "Fragment price must be greater than 0");

		fragment.fragmentPrice = fragmentPrice;
		fragment.isListed = true;

		emit FragmentsListed(tokenId, fragmentPrice);
	}

	function getFragmentOwnershipCount(
		uint256 tokenId,
		address owner
	) public view returns (uint256) {
		return fragmentedNFTs[tokenId].ownershipCount[owner];
	}

	function isFragmented(uint256 tokenId) public view returns (bool) {
		return fragmentedNFTs[tokenId].totalFragments > 0;
	}

	function setMerkleRoot(string memory _merkleRoot) public {
		merkleRoot = _merkleRoot;
	}

	function getMerkleRoot() public view returns (string memory) {
		return merkleRoot;
	}

	function setMerkleProof(bytes32[] calldata _merkleProof) public {
		merkleProofs[msg.sender] = _merkleProof;
	}
	function claimAirdrop(
		uint256 tokenId,
		string calldata inputMerkleRoot
	) public {
		require(
			!airdropClaimed[msg.sender],
			"Airdrop already claimed by this address"
		);

		// 检查传入的 Merkle 根是否与存储的 Merkle 根相同
		require(
			keccak256(abi.encodePacked(inputMerkleRoot)) ==
				keccak256(abi.encodePacked(merkleRoot)),
			"Invalid Merkle Root"
		);

		airdropClaimed[msg.sender] = true;

		_transfer(ownerOf(tokenId), msg.sender, tokenId);
		emit AirdropClaimed(msg.sender, tokenId);
	}

	Counters.Counter private blindBoxIdCounter;

	function mintBlindBox(
		address to,
		string[] memory uris,
		address[] memory royaltyReceivers,
		uint96[] memory feeNumerators,
		uint256 price
	) public returns (uint256[] memory) {
		uint256[] memory newTokenIds = new uint256[](uris.length);
		for (uint i = 0; i < uris.length; i++) {
			newTokenIds[i] = mintItem(
				to,
				uris[i],
				royaltyReceivers[i],
				feeNumerators[i]
			);
		}
		blindBoxIdCounter.increment(); // 使用独立的计数器
		uint256 blindBoxId = blindBoxIdCounter.current(); // 获取独立计数器的当前值
		blindBoxes[blindBoxId] = BlindBox({
			tokenIds: newTokenIds,
			isSold: false,
			price: price
		});
		blindBoxIndices.push(blindBoxId);
		return newTokenIds;
	}

	function buyBlindBox(uint256 blindBoxId, uint256 nftId) public payable {
		BlindBox storage box = blindBoxes[blindBoxId];
		require(!box.isSold, "Blind box already sold");
		require(
			msg.value >= box.price,
			"Insufficient funds to purchase blind box"
		);

		// 检查指定的 nftId 是否在盲盒中
		bool nftFound = false;
		for (uint i = 0; i < box.tokenIds.length; i++) {
			if (box.tokenIds[i] == nftId) {
				nftFound = true;
				break;
			}
		}
		require(nftFound, "NFT ID not found in the blind box");

		// 将指定的 NFT 转移给买家
		_transfer(ownerOf(nftId), msg.sender, nftId);

		box.isSold = true;

		emit Purchase(
			blindBoxId,
			ownerOf(blindBoxId),
			msg.sender,
			box.price,
			0,
			address(0),
			block.timestamp,
			false
		);
	}

	function getBlindBoxes() public view returns (BlindBox[] memory) {
		uint256 totalBlindBoxes = blindBoxIndices.length;
		BlindBox[] memory boxes = new BlindBox[](totalBlindBoxes);
		for (uint256 i = 0; i < totalBlindBoxes; i++) {
			boxes[i] = blindBoxes[blindBoxIndices[i]];
		}
		return boxes;
	}

	// 简化的获取碎片详情函数
	function getSimpleFragmentDetails(
		uint256 tokenId,
		address owner
	) public view returns (SimpleFragmentDetails memory) {
		FragmentedNFT storage fragment = fragmentedNFTs[tokenId];
		return
			SimpleFragmentDetails({
				tokenUri: tokenURI(tokenId),
				totalFragments: fragment.totalFragments,
				fragmentsAvailable: fragment.fragmentsAvailable,
				ownedCount: fragment.ownershipCount[owner],
				fragmentPrice: fragment.fragmentPrice,
				isListed: fragment.isListed
			});
	}

	function relistFragments(
		uint256 tokenId,
		uint256 amount,
		uint256 price
	) public {
		FragmentedNFT storage fragment = fragmentedNFTs[tokenId];
		require(
			fragment.ownershipCount[msg.sender] >= amount,
			"Not enough fragments owned"
		);
		require(price > 0, "Price must be greater than 0");
		FragmentListing storage listing = fragment.fragmentListings[msg.sender];
		require(!listing.isListed, "You already have fragments listed");
		listing.listedAmount = amount;
		listing.price = price;
		listing.isListed = true;
		emit FragmentRelisted(tokenId, msg.sender, amount, price);
	}

	function delistFragments(uint256 tokenId) public {
		FragmentedNFT storage fragment = fragmentedNFTs[tokenId];
		FragmentListing storage listing = fragment.fragmentListings[msg.sender];
		require(listing.isListed, "No fragments listed");
		listing.isListed = false;
		listing.listedAmount = 0;
		listing.price = 0;
	}

	function buyListedFragments(
		uint256 tokenId,
		address seller,
		uint256 amount
	) public payable {
		FragmentedNFT storage fragment = fragmentedNFTs[tokenId];
		FragmentListing storage listing = fragment.fragmentListings[seller];
		require(listing.isListed, "Fragments not listed for sale");
		require(
			amount <= listing.listedAmount,
			"Not enough fragments available"
		);
		require(msg.value >= listing.price * amount, "Insufficient payment");
		// 转移碎片所有权
		fragment.ownershipCount[seller] -= amount;
		fragment.ownershipCount[msg.sender] += amount;
		// 更新上架信息
		listing.listedAmount -= amount;
		if (listing.listedAmount == 0) {
			listing.isListed = false;
		}
		// 移支付
		payable(seller).transfer(msg.value);
		emit FragmentSold(tokenId, seller, msg.sender, amount, listing.price);
	}

	function getFragmentListing(
		uint256 tokenId,
		address seller
	) public view returns (FragmentListingDetails memory) {
		FragmentedNFT storage fragment = fragmentedNFTs[tokenId];
		FragmentListing storage listing = fragment.fragmentListings[seller];
		return
			FragmentListingDetails({
				listedAmount: listing.listedAmount,
				price: listing.price,
				isListed: listing.isListed,
				tokenUri: tokenURI(tokenId),
				totalFragments: fragment.totalFragments,
				fragmentsAvailable: fragment.fragmentsAvailable,
				ownerTotalFragments: fragment.ownershipCount[seller]
			});
	}

	function rentOut(uint256 tokenId, uint256 price, uint256 duration) public {
		
		rentals[tokenId] = RentalListing({
			owner: msg.sender,
			renter: address(0),
			price: price,
			endTime: block.timestamp + duration
		});
	}

	function rent(uint256 tokenId) public payable {
		RentalListing storage rental = rentals[tokenId];
		
		_transfer(rental.owner, msg.sender, tokenId);
		
		rental.renter = msg.sender;
		
		payable(rental.owner).transfer(msg.value);
		
		emit NFTRented(
			tokenId,
			rental.owner,
			msg.sender,
			rental.price,
			rental.endTime
		);
	}

	function endRental(uint256 tokenId) public {
		RentalListing storage rental = rentals[tokenId];
		require(
			block.timestamp >= rental.endTime || msg.sender == rental.owner,
			"Rental period not ended and caller is not owner"
		);
		
		// Transfer NFT back to owner
		_transfer(rental.renter, rental.owner, tokenId);
		
		// Reset rental listing
		rental.renter = address(0);
		rental.endTime = 0;
		rental.price = 0;
	}

	function getAllRentals() public view returns (RentalDetails[] memory) {
		uint256 totalNFTs = tokenIdCounter.current();
		uint256 rentalCount = 0;
		
		// 首先计算实际的租赁数量
		for (uint256 i = 1; i <= totalNFTs; i++) {
			if (rentals[i].owner != address(0)) {
				rentalCount++;
			}
		}
		
		RentalDetails[] memory allRentals = new RentalDetails[](rentalCount);
		uint256 currentIndex = 0;
		
		for (uint256 i = 1; i <= totalNFTs; i++) {
			if (rentals[i].owner != address(0)) {
				RentalListing memory rental = rentals[i];
				allRentals[currentIndex] = RentalDetails({
					tokenId: i,
					owner: rental.owner,
					renter: rental.renter,
					price: rental.price,
					endTime: rental.endTime,
					isRented: rental.renter != address(0),
					tokenUri: tokenURI(i)
				});
				currentIndex++;
			}
		}
		
		return allRentals;
	}
}
