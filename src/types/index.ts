/**
 * TypeScript type definitions for YellowPay extension
 */

// Content metadata extracted from HTML
export interface ContentMetadata {
  contentId: string;
  price: string;
  asset: string;
  creator: string;
  domain: string;
  expiry?: number;
}

// Unlock record stored in chrome.storage
export interface UnlockRecord {
  unlockedAt: number;
  expiresAt: number;
  price: string;
  creator: string;
  txHash: string;
  verified: boolean;
}

// Session key information
export interface SessionKey {
  privateKey: string;
  publicKey: string;
  expiresAt: number;
  allowances: Array<{
    asset: string;
    amount: string;
  }>;
}

// Chrome storage schema
export interface StorageSchema {
  sessionKey?: SessionKey;
  purchases: Record<string, Record<string, UnlockRecord>>; // domain -> contentId -> record
  activeChannel?: {
    channelId: string;
    balance: string;
    createdAt: number;
  };
  settings: ExtensionSettings;
}

// Extension settings
export interface ExtensionSettings {
  autoApprove: boolean;
  maxAutoApproveAmount: string;
  defaultExpiry: number;
  debugMode: boolean;
}

// Message types for chrome.runtime communication
export type MessageType =
  | 'REQUEST_UNLOCK'
  | 'UNLOCK_SUCCESS'
  | 'UNLOCK_FAILED'
  | 'CHECK_BALANCE'
  | 'GET_SESSION'
  | 'AUTH_REQUIRED'
  | 'INSUFFICIENT_BALANCE';

// Generic message structure
export interface Message<T = any> {
  type: MessageType;
  data: T;
}

// Yellow Network configuration
export interface YellowConfig {
  clearnodeUrl: string;
  custodyAddress: string;
  adjudicatorAddress: string;
  chainId: number;
}

// Transfer result
export interface TransferResult {
  success: boolean;
  txHash?: string;
  timestamp?: number;
  error?: string;
}
