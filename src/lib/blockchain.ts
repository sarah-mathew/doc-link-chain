import CryptoJS from 'crypto-js';

export interface BlockData {
  fileName: string;
  fileHash: string;
  senderId: string;
  senderName: string;
  receiverId?: string;
  receiverName?: string;
  timestamp: string;
}

export interface Block {
  index: number;
  timestamp: string;
  data: BlockData;
  previousHash: string;
  hash: string;
}

export class Blockchain {
  private chain: Block[];

  constructor() {
    this.chain = [];
  }

  createGenesisBlock(): Block {
    const genesisData: BlockData = {
      fileName: "Genesis Block",
      fileHash: "0",
      senderId: "system",
      senderName: "System",
      timestamp: new Date().toISOString()
    };
    
    return {
      index: 0,
      timestamp: new Date().toISOString(),
      data: genesisData,
      previousHash: "0",
      hash: this.calculateHash(0, new Date().toISOString(), genesisData, "0")
    };
  }

  calculateHash(index: number, timestamp: string, data: BlockData, previousHash: string): string {
    return CryptoJS.SHA256(
      index + timestamp + JSON.stringify(data) + previousHash
    ).toString();
  }

  getLatestBlock(): Block {
    return this.chain[this.chain.length - 1];
  }

  addBlock(data: BlockData): Block {
    const previousBlock = this.chain.length > 0 ? this.getLatestBlock() : this.createGenesisBlock();
    const newIndex = previousBlock.index + 1;
    const timestamp = new Date().toISOString();
    
    const newBlock: Block = {
      index: newIndex,
      timestamp,
      data,
      previousHash: previousBlock.hash,
      hash: this.calculateHash(newIndex, timestamp, data, previousBlock.hash)
    };

    this.chain.push(newBlock);
    return newBlock;
  }

  isChainValid(): boolean {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Recalculate hash
      const calculatedHash = this.calculateHash(
        currentBlock.index,
        currentBlock.timestamp,
        currentBlock.data,
        currentBlock.previousHash
      );

      // Verify current block hash
      if (currentBlock.hash !== calculatedHash) {
        return false;
      }

      // Verify link to previous block
      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }
    return true;
  }

  getChain(): Block[] {
    return this.chain;
  }

  setChain(chain: Block[]) {
    this.chain = chain;
  }
}
