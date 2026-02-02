import { NitroliteClient, WalletStateSigner } from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

/**
 * Singleton class for managing Yellow Network client
 * Handles NitroliteClient initialization and configuration
 */
class YellowClient {
  private static instance: YellowClient | null = null;
  private nitroliteClient: NitroliteClient | null = null;
  private publicClient: any;
  private walletClient: any;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Get singleton instance of YellowClient
   */
  public static getInstance(): YellowClient {
    if (!YellowClient.instance) {
      YellowClient.instance = new YellowClient();
    }
    return YellowClient.instance;
  }

  /**
   * Initialize the Yellow Network client
   * @param privateKey - Private key for wallet (from environment)
   * @param rpcUrl - RPC URL for Sepolia network
   */
  public async initialize(privateKey: string, rpcUrl: string): Promise<void> {
    try {
      // Create account from private key
      const account = privateKeyToAccount(privateKey as `0x${string}`);

      // Initialize public client for reading blockchain data
      this.publicClient = createPublicClient({
        chain: sepolia,
        transport: http(rpcUrl)
      });

      // Initialize wallet client for signing transactions
      this.walletClient = createWalletClient({
        chain: sepolia,
        transport: http(rpcUrl),
        account
      });

      // Initialize NitroliteClient with Yellow Network configuration
      this.nitroliteClient = new NitroliteClient({
        publicClient: this.publicClient,
        walletClient: this.walletClient,
        stateSigner: new WalletStateSigner(this.walletClient),
        addresses: {
          custody: '0x019B65A265EB3363822f2752141b3dF16131b262',
          adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2'
        },
        chainId: sepolia.id, // 11155111
        challengeDuration: 3600n // 1 hour in seconds
      });

      console.log('✅ Yellow Network client initialized');
      console.log('   Chain:', sepolia.name);
      console.log('   Address:', account.address);
    } catch (error) {
      console.error('❌ Failed to initialize Yellow Network client:', error);
      throw error;
    }
  }

  /**
   * Get the NitroliteClient instance
   */
  public getClient(): NitroliteClient {
    if (!this.nitroliteClient) {
      throw new Error('YellowClient not initialized. Call initialize() first.');
    }
    return this.nitroliteClient;
  }

  /**
   * Get the public client (for reading blockchain data)
   */
  public getPublicClient() {
    if (!this.publicClient) {
      throw new Error('YellowClient not initialized. Call initialize() first.');
    }
    return this.publicClient;
  }

  /**
   * Get the wallet client (for signing transactions)
   */
  public getWalletClient() {
    if (!this.walletClient) {
      throw new Error('YellowClient not initialized. Call initialize() first.');
    }
    return this.walletClient;
  }

  /**
   * Check if client is initialized
   */
  public isInitialized(): boolean {
    return this.nitroliteClient !== null;
  }
}

export default YellowClient;
