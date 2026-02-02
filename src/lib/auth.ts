import {
    createAuthRequestMessage,
    createAuthVerifyMessageFromChallenge,
    createEIP712AuthMessageSigner
} from '@erc7824/nitrolite';
import { SessionKey } from '../types';
import WebSocketManager from './websocket';

/**
 * Authentication Manager for Yellow Network
 * Handles the complete auth flow: request → challenge → verify → success
 *
 * Based on DOC3 (Quickstart Guide) Section 3: Authentication
 */
class AuthManager {
  private static instance: AuthManager | null = null;
  private wsManager: WebSocketManager;
  private authInProgress = false;
  private authPromise: Promise<any> | null = null;

  private constructor() {
    this.wsManager = WebSocketManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  /**
   * Complete authentication flow
   * Based on DOC3: Authentication section
   *
   * @param sessionKey - Generated session key
   * @param walletClient - Viem wallet client for signing
   * @param userAddress - User's main wallet address
   */
  public async authenticate(
    sessionKey: SessionKey,
    walletClient: any,
    userAddress: string
  ): Promise<{ success: boolean; balance?: any; error?: string }> {
    // Prevent multiple simultaneous auth attempts
    if (this.authInProgress) {
      console.log('⏳ Authentication already in progress, waiting...');
      return this.authPromise!;
    }

    this.authInProgress = true;
    this.authPromise = this._performAuthentication(sessionKey, walletClient, userAddress);

    try {
      const result = await this.authPromise;
      return result;
    } finally {
      this.authInProgress = false;
      this.authPromise = null;
    }
  }

  /**
   * Internal authentication implementation
   */
  private async _performAuthentication(
    sessionKey: SessionKey,
    walletClient: any,
    userAddress: string
  ): Promise<{ success: boolean; balance?: any; error?: string }> {
    try {
      console.log('🔐 Starting authentication flow...');

      // Ensure WebSocket is connected
      if (!this.wsManager.isConnected()) {
        console.log('📡 Connecting to Clearnode...');
        this.wsManager.connect();
        await this.waitForConnection(5000);
      }

      // Step 1: Create and send auth request
      console.log('📤 Step 1/3: Sending auth_request...');
      const authParams = {
        address: userAddress as `0x${string}`,
        application: 'YellowPay Extension',
        session_key: sessionKey.publicKey as `0x${string}`,
        allowances: sessionKey.allowances,
        expires_at: BigInt(Math.floor(sessionKey.expiresAt / 1000)), // Convert to seconds
        scope: 'content.payments'
      };

      const authRequestMsg = await createAuthRequestMessage(authParams);
      this.wsManager.send(authRequestMsg);

      // Step 2: Wait for auth_challenge
      console.log('⏳ Step 2/3: Waiting for auth_challenge...');
      const challengeResponse = await this.waitForMessage('auth_challenge', 10000);

      if (!challengeResponse || !challengeResponse.res || !challengeResponse.res[2]) {
        throw new Error('Invalid auth_challenge response');
      }

      const challengeMessage = challengeResponse.res[2].challenge_message;
      console.log('✅ Received challenge');

      // Step 3: Sign challenge with main wallet (EIP-712)
      console.log('✍️ Step 3/3: Signing challenge with main wallet...');
      const signer = createEIP712AuthMessageSigner(
        walletClient,
        authParams,
        { name: 'YellowPay Extension' }
      );

      const verifyMsg = await createAuthVerifyMessageFromChallenge(
        signer,
        challengeMessage
      );

      this.wsManager.send(verifyMsg);

      // Step 4: Wait for auth_success
      console.log('⏳ Waiting for auth_success...');
      const successResponse = await this.waitForMessage('auth_success', 10000);

      if (!successResponse || !successResponse.res) {
        throw new Error('Invalid auth_success response');
      }

      const responseData = successResponse.res[2];
      console.log('✅ Authentication successful!');
      console.log('   Session ID:', responseData.session_id);
      console.log('   Balance:', responseData.balance);

      return {
        success: true,
        balance: responseData.balance
      };

    } catch (error) {
      console.error('❌ Authentication failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Wait for WebSocket connection
   */
  private waitForConnection(timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkConnection = () => {
        if (this.wsManager.isConnected()) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('WebSocket connection timeout'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  /**
   * Wait for specific message type from Clearnode
   */
  private waitForMessage(messageType: string, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.wsManager.off(messageType, handler);
        reject(new Error(`Timeout waiting for ${messageType}`));
      }, timeout);

      const handler = (message: any) => {
        clearTimeout(timeoutId);
        this.wsManager.off(messageType, handler);
        resolve(message);
      };

      this.wsManager.on(messageType, handler);
    });
  }

  /**
   * Check if currently authenticated
   */
  public isAuthenticated(): boolean {
    return this.wsManager.isConnected() && !this.authInProgress;
  }

  /**
   * Logout / clear authentication
   */
  public logout(): void {
    console.log('🚪 Logging out...');
    this.wsManager.disconnect();
    this.authInProgress = false;
    this.authPromise = null;
  }
}

export default AuthManager;
