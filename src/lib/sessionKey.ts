import { createECDSAMessageSigner } from '@erc7824/nitrolite';
import CryptoJS from 'crypto-js';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { SESSION_KEY_DURATION } from '../config';
import { SessionKey } from '../types';

/**
 * Session Key Manager
 * Handles generation, storage, and lifecycle of session keys for gasless transactions
 *
 * Based on DOC3 (Quickstart Guide) authentication flow
 */
class SessionKeyManager {
  private static instance: SessionKeyManager | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SessionKeyManager {
    if (!SessionKeyManager.instance) {
      SessionKeyManager.instance = new SessionKeyManager();
    }
    return SessionKeyManager.instance;
  }

  /**
   * Generate a new session key
   * Based on DOC3: Generate temporary session key
   */
  public generateSessionKey(allowances: Array<{ asset: string; amount: string }>): SessionKey {
    console.log('🔑 Generating new session key...');

    // Generate random private key
    const sessionPrivateKey = generatePrivateKey();
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);

    const sessionKey: SessionKey = {
      privateKey: sessionPrivateKey,
      publicKey: sessionAccount.address,
      expiresAt: Date.now() + SESSION_KEY_DURATION,
      allowances
    };

    console.log('✅ Session key generated');
    console.log('   Address:', sessionAccount.address);
    console.log('   Expires:', new Date(sessionKey.expiresAt).toLocaleString());
    console.log('   Allowances:', allowances);

    return sessionKey;
  }

  /**
   * Create message signer from session key
   * Based on DOC3: const sessionSigner = createECDSAMessageSigner(sessionPrivateKey)
   */
  public createSigner(privateKey: string) {
    return createECDSAMessageSigner(privateKey as `0x${string}`);
  }

  /**
   * Save session key to chrome.storage.local (encrypted)
   */
  public async saveToStorage(sessionKey: SessionKey, password: string): Promise<void> {
    try {
      console.log('💾 Saving session key to storage...');

      // Encrypt sensitive data
      const encrypted = this.encrypt(JSON.stringify(sessionKey), password);

      await chrome.storage.local.set({
        encryptedSessionKey: encrypted,
        sessionKeyExpiry: sessionKey.expiresAt
      });

      console.log('✅ Session key saved securely');
    } catch (error) {
      console.error('❌ Failed to save session key:', error);
      throw error;
    }
  }

  /**
   * Load session key from chrome.storage.local (decrypt)
   */
  public async loadFromStorage(password: string): Promise<SessionKey | null> {
    try {
      const result = await chrome.storage.local.get(['encryptedSessionKey', 'sessionKeyExpiry']);

      if (!result.encryptedSessionKey) {
        console.log('ℹ️ No session key found in storage');
        return null;
      }

      // Decrypt
      const decrypted = this.decrypt(result.encryptedSessionKey, password);
      const sessionKey: SessionKey = JSON.parse(decrypted);

      // Check if expired
      if (this.isExpired(sessionKey)) {
        console.log('⚠️ Session key expired, removing from storage');
        await this.clearFromStorage();
        return null;
      }

      console.log('✅ Session key loaded from storage');
      console.log('   Address:', sessionKey.publicKey);
      console.log('   Expires:', new Date(sessionKey.expiresAt).toLocaleString());

      return sessionKey;
    } catch (error) {
      console.error('❌ Failed to load session key:', error);
      return null;
    }
  }

  /**
   * Check if session key is expired
   */
  public isExpired(sessionKey: SessionKey): boolean {
    return Date.now() > sessionKey.expiresAt;
  }

  /**
   * Check if session key needs rotation (expired or allowance exceeded)
   */
  public needsRotation(sessionKey: SessionKey, spentAmount: string, asset: string): boolean {
    // Check expiry
    if (this.isExpired(sessionKey)) {
      console.log('⚠️ Session key expired');
      return true;
    }

    // Check allowance
    const allowance = sessionKey.allowances.find(a => a.asset === asset);
    if (allowance) {
      const spent = parseFloat(spentAmount);
      const limit = parseFloat(allowance.amount);

      if (spent >= limit) {
        console.log('⚠️ Session key allowance exceeded');
        return true;
      }
    }

    return false;
  }

  /**
   * Rotate session key if needed
   */
  public async rotateIfNeeded(
    sessionKey: SessionKey | null,
    spentAmount: string,
    asset: string,
    password: string
  ): Promise<SessionKey> {
    if (!sessionKey || this.needsRotation(sessionKey, spentAmount, asset)) {
      console.log('🔄 Rotating session key...');

      // Generate new session key with same allowances
      const allowances = sessionKey?.allowances || [
        { asset: 'ytest.usd', amount: '100' }
      ];

      const newSessionKey = this.generateSessionKey(allowances);
      await this.saveToStorage(newSessionKey, password);

      return newSessionKey;
    }

    return sessionKey;
  }

  /**
   * Clear session key from storage
   */
  public async clearFromStorage(): Promise<void> {
    try {
      await chrome.storage.local.remove(['encryptedSessionKey', 'sessionKeyExpiry']);
      console.log('✅ Session key cleared from storage');
    } catch (error) {
      console.error('❌ Failed to clear session key:', error);
    }
  }

  /**
   * Encrypt data using AES-256
   */
  private encrypt(data: string, password: string): string {
    return CryptoJS.AES.encrypt(data, password).toString();
  }

  /**
   * Decrypt data using AES-256
   */
  private decrypt(encrypted: string, password: string): string {
    const bytes = CryptoJS.AES.decrypt(encrypted, password);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Validate password strength
   */
  public validatePassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters' };
    }

    // Check for complexity (optional but recommended)
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return {
        valid: false,
        message: 'Password must contain uppercase, lowercase, and numbers'
      };
    }

    return { valid: true };
  }

  /**
   * Generate a secure random password for session key encryption
   * (for auto-generated password scenario)
   */
  public generatePassword(): string {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length];
    }

    return password;
  }

  /**
   * Get remaining time until session key expires
   */
  public getRemainingTime(sessionKey: SessionKey): number {
    return Math.max(0, sessionKey.expiresAt - Date.now());
  }

  /**
   * Format remaining time as human-readable string
   */
  public formatRemainingTime(sessionKey: SessionKey): string {
    const remaining = this.getRemainingTime(sessionKey);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }
}

export default SessionKeyManager;
