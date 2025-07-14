# NFT项目

## 项目简介
这是一个基于区块链技术的NFT（非同质化代币）创建、展示和交易平台。用户可以铸造自己的NFT，在市场上交易，参与拍卖，以及使用盲盒等多种玩法。

## 主要功能
- **NFT铸造**：创建独特的数字艺术品和收藏品
- **NFT市场**：买卖自己的NFT
- **NFT盲盒**：随机获取NFT的趣味玩法
- **空投功能**：支持NFT的空投分发
- **拍卖系统**：参与NFT的实时拍卖
- **区块浏览器**：查看交易历史和区块信息
- **IPFS支持**：使用去中心化存储保存NFT元数据和图片

## 技术栈
- 前端：Next.js, React, TailwindCSS
- 智能合约：Solidity, Hardhat
- 区块链交互：ethers.js, wagmi
- 存储：IPFS

## 如何启动

### 环境准备
首先，请确保安装以下工具：
- Node.js (>= v18.17)
- Yarn (v1或v2+)
- Git

### 安装依赖
```sh
yarn install
```

### 启动本地区块链
```sh
yarn chain
```

### 部署智能合约
在新的终端窗口中：
```sh
yarn deploy
```

### 启动前端应用
在另一个终端窗口中：
```sh
yarn start
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 使用钱包

### 本地开发
- 使用内置的burner钱包进行测试
- 可以通过水龙头(Faucet)按钮获取测试币

### 测试网部署
- 支持连接MetaMask等外部钱包
- 可以在Sepolia测试网络上进行测试

## 项目结构
- `packages/hardhat`：智能合约和部署脚本
- `packages/nextjs`：前端应用代码
  - `app/`：主要页面和组件
  - `components/`：通用UI组件
  - `hooks/`：React Hooks
  - `utils/`：工具函数

## 部署到线上
使用Vercel部署前端：
```sh
yarn vercel
```

## 智能合约验证
在Sepolia测试网上验证合约：
```sh
yarn verify --network sepolia
```

## 联系方式
如有任何问题或建议，欢迎联系项目维护者。
