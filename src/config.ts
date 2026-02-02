/**
 * Yellow Network Configuration
 * Centralized configuration for the extension
 */

// Yellow Network Clearnode
export const CLEARNODE_WS_URL = 'wss://clearnet-sandbox.yellow.com/ws';

// Contract Addresses (Sepolia Testnet)
export const CUSTODY_ADDRESS = '0x019B65A265EB3363822f2752141b3dF16131b262';
export const ADJUDICATOR_ADDRESS = '0x7c7ccbc98469190849BCC6c926307794fDfB11F2';

// Chain Configuration
export const CHAIN_ID = 11155111; // Sepolia
export const CHALLENGE_DURATION = 3600n; // 1 hour in seconds

// Payment Configuration
export const DEFAULT_UNLOCK_EXPIRY = 86400000; // 24 hours in milliseconds
export const MAX_AUTO_APPROVE_AMOUNT = '1.00'; // USDC
export const SESSION_KEY_DURATION = 3600000; // 1 hour in milliseconds

// Supported Assets
export const SUPPORTED_ASSETS = ['ytest.usd', 'usdc'] as const;

// Extension Settings
export const EXTENSION_NAME = 'YellowPay';
export const EXTENSION_VERSION = '0.1.0';
