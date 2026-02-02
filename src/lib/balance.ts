import WebSocketManager from './websocket';

/**
 * Balance Manager for Yellow Network
 * Handles balance queries and updates
 *
 * Based on DOC3: Using Unified Balance
 */
class BalanceManager {
  private static instance: BalanceManager | null = null;
  private wsManager: WebSocketManager;
  private balanceCache: Map<string, { amount: string; timestamp: number }> = new Map();
  private cacheDuration = 30000; // 30 seconds

  private constructor() {
    this.wsManager = WebSocketManager.getInstance();
    this.setupBalanceUpdateListener();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): BalanceManager {
    if (!BalanceManager.instance) {
      BalanceManager.instance = new BalanceManager();
    }
    return BalanceManager.instance;
  }

  /**
   * Get unified balance for a specific asset
   * Based on DOC3: Query balance via get_balance RPC
   *
   * @param asset - Asset identifier (e.g., 'ytest.usd', 'usdc')
   * @param forceRefresh - Skip cache and fetch fresh data
   */
  public async getUnifiedBalance(asset: string, forceRefresh = false): Promise<string> {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = this.balanceCache.get(asset);
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        console.log(` Balance (cached): ${cached.amount} ${asset}`);
        return cached.amount;
      }
    }

    try {
      console.log(` Fetching balance for ${asset}...`);

      // Create get_balance RPC request
      const requestId = Date.now();
      const request = {
        req: [requestId, 'get_balance', { asset }, Date.now()]
      };

      this.wsManager.send(request);

      // Wait for response
      const response = await this.waitForBalanceResponse(requestId, 10000);

      if (!response || !response.res || !response.res[2]) {
        throw new Error('Invalid balance response');
      }

      const balance = response.res[2].balance || '0';

      // Update cache
      this.balanceCache.set(asset, {
        amount: balance,
        timestamp: Date.now()
      });

      console.log(`✅ Balance: ${balance} ${asset}`);
      return balance;

    } catch (error) {
      console.error('❌ Failed to fetch balance:', error);

      // Return cached value if available, otherwise '0'
      const cached = this.balanceCache.get(asset);
      return cached ? cached.amount : '0';
    }
  }

  /**
   * Get balances for multiple assets
   */
  public async getMultipleBalances(assets: string[]): Promise<Record<string, string>> {
    const balances: Record<string, string> = {};

    await Promise.all(
      assets.map(async (asset) => {
        balances[asset] = await this.getUnifiedBalance(asset);
      })
    );

    return balances;
  }

  /**
   * Get channel balance (if using dedicated channels instead of unified balance)
   */
  public async getChannelBalance(channelId: string): Promise<string> {
    try {
      console.log(` Fetching channel balance for ${channelId}...`);

      const requestId = Date.now();
      const request = {
        req: [requestId, 'get_channel_balance', { channel_id: channelId }, Date.now()]
      };

      this.wsManager.send(request);

      const response = await this.waitForBalanceResponse(requestId, 10000);

      if (!response || !response.res || !response.res[2]) {
        throw new Error('Invalid channel balance response');
      }

      const balance = response.res[2].balance || '0';
      console.log(`✅ Channel balance: ${balance}`);
      return balance;

    } catch (error) {
      console.error('❌ Failed to fetch channel balance:', error);
      return '0';
    }
  }

  /**
   * Format balance for display
   * @param amount - Raw amount (e.g., "1000000" for USDC with 6 decimals)
   * @param decimals - Number of decimals (default 6 for USDC)
   */
  public formatBalance(amount: string, decimals: number = 6): string {
    try {
      const numAmount = BigInt(amount);
      const divisor = BigInt(10 ** decimals);
      const whole = numAmount / divisor;
      const remainder = numAmount % divisor;

      // Pad remainder with zeros
      const remainderStr = remainder.toString().padStart(decimals, '0');

      // Remove trailing zeros
      const trimmed = remainderStr.replace(/0+$/, '');

      if (trimmed === '') {
        return whole.toString();
      }

      return `${whole}.${trimmed}`;
    } catch (error) {
      console.error('Failed to format balance:', error);
      return '0';
    }
  }

  /**
   * Parse formatted balance back to raw amount
   */
  public parseBalance(formatted: string, decimals: number = 6): string {
    try {
      const [whole, fraction = ''] = formatted.split('.');
      const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
      const rawAmount = BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFraction);
      return rawAmount.toString();
    } catch (error) {
      console.error('Failed to parse balance:', error);
      return '0';
    }
  }

  /**
   * Subscribe to balance updates from Clearnode
   */
  public subscribeToBalanceUpdates(callback: (asset: string, newBalance: string) => void): void {
    this.wsManager.on('balance_update', (message: any) => {
      try {
        const data = message.res?.[2];
        if (data && data.asset && data.balance) {
          console.log(`💰 Balance updated: ${data.balance} ${data.asset}`);

          // Update cache
          this.balanceCache.set(data.asset, {
            amount: data.balance,
            timestamp: Date.now()
          });

          // Notify callback
          callback(data.asset, data.balance);
        }
      } catch (error) {
        console.error('Error processing balance update:', error);
      }
    });
  }

  /**
   * Setup automatic listener for balance updates
   */
  private setupBalanceUpdateListener(): void {
    this.subscribeToBalanceUpdates((asset, balance) => {
      // Automatically update cache when balance changes
      console.log(`🔄 Auto-updated balance cache: ${balance} ${asset}`);
    });
  }

  /**
   * Clear balance cache
   */
  public clearCache(): void {
    this.balanceCache.clear();
    console.log('🗑️ Balance cache cleared');
  }

  /**
   * Get cached balance (without fetching)
   */
  public getCachedBalance(asset: string): string | null {
    const cached = this.balanceCache.get(asset);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.amount;
    }
    return null;
  }

  /**
   * Wait for balance response from Clearnode
   */
  private waitForBalanceResponse(requestId: number, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.wsManager.off('message', handler);
        reject(new Error('Timeout waiting for balance response'));
      }, timeout);

      const handler = (message: any) => {
        try {
          // Check if this is the response we're waiting for
          if (message.res && message.res[0] === requestId) {
            clearTimeout(timeoutId);
            this.wsManager.off('message', handler);
            resolve(message);
          }
        } catch (error) {
          console.error('Error handling balance response:', error);
        }
      };

      this.wsManager.on('message', handler);
    });
  }
}

export default BalanceManager;
