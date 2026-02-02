/**
 * Background Service Worker for YellowPay Extension
 * Handles WebSocket connection, authentication, and message routing
 */

import AuthManager from './lib/auth';
import BalanceManager from './lib/balance';
import SessionKeyManager from './lib/sessionKey';
import WebSocketManager from './lib/websocket';

// Initialize managers
const wsManager = WebSocketManager.getInstance();
const authManager = AuthManager.getInstance();
const sessionKeyManager = SessionKeyManager.getInstance();
const balanceManager = BalanceManager.getInstance();

console.log('🟡 YellowPay background service worker loaded');

/**
 * Extension installation/update handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('📦 YellowPay extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First time installation
    console.log('🎉 First time installation');

    // Initialize default settings
    await chrome.storage.local.set({
      settings: {
        autoApprove: false,
        autoApproveThreshold: '1.00',
        sessionKeyDuration: 3600000, // 1 hour
        defaultUnlockExpiry: 86400000, // 24 hours
        debugMode: false
      }
    });

    console.log('✅ Default settings initialized');
  }

  // Connect to WebSocket on startup
  initializeExtension();
});

/**
 * Extension startup handler
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('🚀 Browser started, initializing extension...');
  initializeExtension();
});

/**
 * Initialize extension components
 */
async function initializeExtension() {
  try {
    console.log('🔧 Initializing extension components...');

    // Connect to Clearnode WebSocket
    wsManager.connect();

    // Setup heartbeat alarm for keepalive
    chrome.alarms.create('heartbeat', { periodInMinutes: 0.5 });
    console.log('💓 Heartbeat alarm created (30 seconds)');

    // Check for existing session key
    const result = await chrome.storage.local.get(['sessionKeyExpiry']);
    if (result.sessionKeyExpiry && Date.now() < result.sessionKeyExpiry) {
      console.log('🔑 Valid session key found, extension ready');
    } else {
      console.log('⚠️ No valid session key, authentication required');
    }

  } catch (error) {
    console.error('❌ Failed to initialize extension:', error);
  }
}

/**
 * Heartbeat alarm handler - keeps WebSocket alive
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'heartbeat') {
    // Check WebSocket connection
    if (!wsManager.isConnected()) {
      console.log('💓 Heartbeat: WebSocket disconnected, reconnecting...');
      wsManager.connect();
    } else {
      console.log('💓 Heartbeat: WebSocket connected');
    }
  }
});

/**
 * Message handler - routes messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Received message:', request.type, 'from:', sender.tab?.id || 'popup');

  // Handle async operations
  handleMessage(request, sender).then(sendResponse);

  // Return true to indicate async response
  return true;
});

/**
 * Handle incoming messages
 */
async function handleMessage(request: any, sender: any): Promise<any> {
  try {
    switch (request.type) {
      case 'REQUEST_UNLOCK':
        return await handleUnlockRequest(request.data, sender);

      case 'CHECK_BALANCE':
        return await handleBalanceCheck(request.data);

      case 'GET_SESSION':
        return await handleGetSession();

      case 'CHECK_UNLOCK_STATUS':
        return await handleCheckUnlockStatus(request.data);

      case 'AUTHENTICATE':
        return await handleAuthenticate(request.data);

      default:
        console.warn('⚠️ Unknown message type:', request.type);
        return { success: false, error: 'Unknown message type' };
    }
  } catch (error: any) {
    console.error('❌ Error handling message:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle unlock request from content script
 */
async function handleUnlockRequest(metadata: any, sender: any): Promise<any> {
  console.log('🔓 Processing unlock request:', metadata.contentId);

  try {
    // TODO: Implement in Phase 4 - Payment Flow
    // For now, return placeholder response

    return {
      success: false,
      error: 'Payment flow not yet implemented (Phase 4)'
    };

  } catch (error: any) {
    console.error('❌ Unlock request failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle balance check request
 */
async function handleBalanceCheck(data: any): Promise<any> {
  console.log('💰 Checking balance for asset:', data.asset);

  try {
    const balance = await balanceManager.getUnifiedBalance(data.asset || 'ytest.usd');

    return {
      success: true,
      balance: balance
    };

  } catch (error: any) {
    console.error('❌ Balance check failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get session request
 */
async function handleGetSession(): Promise<any> {
  console.log('🔑 Getting session information');

  try {
    // Note: Password required for decryption, will be handled in popup UI
    // For now, check if session key exists
    const result = await chrome.storage.local.get(['sessionKeyExpiry']);

    if (!result.sessionKeyExpiry) {
      return {
        success: true,
        authenticated: false,
        message: 'No session key found'
      };
    }

    const isExpired = Date.now() > result.sessionKeyExpiry;

    return {
      success: true,
      authenticated: !isExpired,
      sessionKey: {
        expiresAt: result.sessionKeyExpiry,
        isExpired: isExpired
      }
    };

  } catch (error: any) {
    console.error('❌ Get session failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle check unlock status request
 */
async function handleCheckUnlockStatus(data: any): Promise<any> {
  console.log('🔍 Checking unlock status:', data.contentId);

  try {
    // TODO: Implement in Phase 4 - Storage Manager
    // For now, return placeholder response

    return {
      success: true,
      unlocked: false,
      message: 'Storage manager not yet implemented (Phase 4)'
    };

  } catch (error: any) {
    console.error('❌ Check unlock status failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle authentication request
 */
async function handleAuthenticate(data: any): Promise<any> {
  console.log('🔐 Processing authentication request');

  try {
    // Generate new session key with default allowances
    const defaultAllowances = [
      { asset: 'ytest.usd', amount: '1000' }
    ];

    const sessionKey = sessionKeyManager.generateSessionKey(defaultAllowances);
    console.log('✅ Session key generated');

    // Save to storage (password will be provided by popup)
    if (data.password) {
      await sessionKeyManager.saveToStorage(sessionKey, data.password);
      console.log('✅ Session key saved to storage');
    }

    // TODO: Complete authentication with Yellow Network
    // Will be integrated with AuthManager in next steps

    return {
      success: true,
      sessionKey: {
        publicKey: sessionKey.publicKey,
        expiresAt: sessionKey.expiresAt
      },
      message: 'Session key generated, full auth flow pending integration'
    };

  } catch (error: any) {
    console.error('❌ Authentication failed:', error);
    return { success: false, error: error.message };
  }
}
