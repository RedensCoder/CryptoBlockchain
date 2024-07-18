import Gun from 'gun';
import 'gun/axe';
import 'gun/lib/unset.js';

const gun = Gun();

interface Transaction {
    sender: string;
    recipient: string;
    amount: number;
}

interface Block {
    index: number;
    timestamp: number;
    previousHash: string;
    hash: string;
    nonce: number
}

interface MarketData {
    totalBought: number;
    totalSold: number;
    totalSupply: number;
    buyPrice: number;
    sellPrice: number;
}

class Blockchain {
    difficulty: number = 2;
    miningReward: number = 1;
    maxCoins = 1000000;
    initialPrice = 1;
    spread = 0.5;
    maxTransactionAmount = 1000;

    constructor() {
        this.createGenesisBlock()
        this.initMarketData();
    }

    async createGenesisBlock() {
        const genesisTransaction: Transaction = { sender: 'system', recipient: 'system', amount: 0 };
        const genesisBlock: Block = {
            index: 0,
            timestamp: Date.now(),
            previousHash: '0',
            nonce: 0,
            hash: await this.calculateHash(0, Date.now(), '0', 0, genesisTransaction),
        };
        gun.get('blockchain').set(genesisBlock);
        gun.get("blockchain").get("transaction").set(genesisTransaction);
    }

    async initMarketData() {
        const marketData: MarketData = {
            totalBought: 0,
            totalSold: 0,
            totalSupply: 0,
            buyPrice: this.initialPrice,
            sellPrice: this.initialPrice,
        };
        gun.get('marketData').put(marketData);
    }

    async calculateHash(index: number, timestamp: number, previousHash: string, nonce: number, transaction: Transaction): Promise<string> {
        const data: string = index + timestamp + previousHash + nonce + JSON.stringify(transaction);
        const hash = await Gun.SEA.work(data, null, null, { name: 'SHA-256' });

        if (hash !== undefined) return hash;
        return "null";
    }

    async createTransaction(sender: string, recipient: string, amount: number) {
        if (amount > this.maxTransactionAmount) {
            throw new Error('Transaction amount exceeds the maximum limit');
        }

        if (sender !== 'system') {
            const senderBalance = await this.getBalance(sender);
            if (senderBalance < amount) {
                throw new Error('Insufficient balance');
            }
        }

        const marketData = await this.getMarketData();

        if (marketData.totalSupply + amount > this.maxCoins && sender === 'system') {
            throw new Error('Exceeds maximum supply in circulation');
        }

        const transaction: Transaction = { sender, recipient, amount };

        if (sender === 'system') {
            marketData.totalBought += amount;
            marketData.totalSupply += amount;
        } else if (recipient === 'system') {
            marketData.totalSold += amount;
            marketData.totalSupply -= amount;
        }

        if (sender === 'system' || recipient === 'system') {
            const { buyPrice, sellPrice } = this.calculatePrices(marketData.totalBought, marketData.totalSold, marketData.totalSupply, amount);
            marketData.buyPrice = buyPrice;
            marketData.sellPrice = sellPrice;
        }

        gun.get('marketData').set(marketData);

        const newBlock: Block = await this.mineBlock(transaction);
        return newBlock;
    }

    async getLatestBlock(): Promise<Block> {
        const blockchain = await this.getBlockchain();
        return blockchain[blockchain.length - 1];
    }

    async mineBlock(transaction: Transaction): Promise<Block> {
        const latestBlock = await this.getLatestBlock();
        const newBlock: Block = {
            index: latestBlock.index + 1,
            timestamp: Date.now(),
            previousHash: latestBlock.hash,
            nonce: 0,
            hash: ''
        };

        newBlock.hash = await this.calculateHash(newBlock.index, newBlock.timestamp, newBlock.previousHash, newBlock.nonce, transaction);
        let attempts = 0;

        while (newBlock.hash.substring(0, this.difficulty) !== Array(this.difficulty + 1).join('0')) {
            newBlock.nonce++;
            newBlock.hash = await this.calculateHash(newBlock.index, newBlock.timestamp, newBlock.previousHash, newBlock.nonce, transaction);

            attempts++;
            if (attempts >= 100000) {
                newBlock.timestamp = Date.now();
                attempts = 0;
            }
        }

        gun.get('blockchain').set(newBlock);
        gun.get('blockchain').get("transaction").set(transaction);
        return newBlock;
    }

    async getBlockchain(): Promise<Block[]> {
        return new Promise((resolve, reject) => {
            const blockchain: Block[] = [];
            gun.get('blockchain').map().once((block) => {
                if (block) {
                    let filteredData: any = {};
                    for (let key in block) {
                        if (block.hasOwnProperty(key) && typeof block[key] !== 'object') {
                            filteredData[key] = block[key];
                            blockchain.push(filteredData);
                        }
                    }
                }
            });
            setTimeout(() => {
                resolve(blockchain);
            }, 1000);
        });
    }

    async getMarketData(): Promise<MarketData> {
        return new Promise((resolve, reject) => {
            gun.get('marketData').once((data: MarketData) => {
                resolve(data);
            });
        });
    }

    calculatePrices(totalBought: number, totalSold: number, totalSupply: number, amount: number): { buyPrice: number, sellPrice: number } {
        const k = 0.01;
        const delta = Math.log(1 + k * amount);
        const basePrice = this.initialPrice * (1 + delta * (totalBought - totalSold) / (totalSupply || 1));
        const buyPrice = basePrice * (1 + this.spread);
        const sellPrice = basePrice * (1 - this.spread);
        return { buyPrice, sellPrice };
    }

    async getBalance(publicKey: string): Promise<number> {
        let balance = 0;

        await gun.get("blockchain").get("transaction").map().on(tx =>{
            if (tx.sender === publicKey) {
                balance -= tx.amount;
            }
            if (tx.recipient === publicKey) {
                balance += tx.amount;
            }
        })

        return balance;
    }
}

export default Blockchain;