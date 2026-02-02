/**
 * YellowPay Content Script
 *
 * Responsibilities:
 * - Detect blur elements with data-yellowpay-* attributes
 * - Extract creator wallet address and content metadata
 * - Inject unlock UI (button + overlay)
 * - Handle unlock requests and communicate with background script
 * - Auto-unlock for content creators visiting their own content
 */

import type { ContentMetadata } from './types';

// Track detected paywall elements
const paywallElements = new Map<string, HTMLElement>();
let currentUserAddress: string | null = null;

console.log('🟡 YellowPay content script loaded');

/**
 * Initialize content script
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function init() {
  console.log('🔍 Scanning for paywall content...');

  // Get current user's wallet address from background
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_USER_ADDRESS'
    });

    if (response.success && response.address) {
      currentUserAddress = response.address;
      console.log('👤 Current user:', currentUserAddress?.substring(0, 10) + '...');
    }
  } catch (error) {
    console.warn('⚠️ Could not get user address:', error);
  }

  // Scan for paywall elements
  scanForPaywalls();

  // Watch for dynamically added content
  observeDOM();

  // Listen for unlock confirmations from background
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
}

/**
 * Scan DOM for elements with Yellow Pay attributes
 */
function scanForPaywalls() {
  // Find all elements with data-yellowpay-blur attribute
  const blurElements = document.querySelectorAll<HTMLElement>('[data-yellowpay-blur="true"]');

  console.log(` Found ${blurElements.length} paywall elements`);

  blurElements.forEach((element) => {
    const contentId = element.getAttribute('data-yellowpay-content-id');

    if (!contentId) {
      console.warn(' Blur element missing content-id:', element);
      return;
    }

    // Skip if already processed
    if (paywallElements.has(contentId)) {
      return;
    }

    // Extract metadata
    const metadata = extractMetadata(element);

    if (!metadata) {
      console.warn('⚠️ Invalid metadata for content:', contentId);
      return;
    }

    // Store element
    paywallElements.set(contentId, element);

    // Check if user is the creator (auto-unlock)
    if (currentUserAddress && metadata.creatorAddress.toLowerCase() === currentUserAddress.toLowerCase()) {
      console.log('👑 Creator detected, auto-unlocking:', contentId);
      unlockContent(contentId, element, true);
      return;
    }

    // Check if already unlocked
    checkUnlockStatus(contentId, element, metadata);
  });
}

/**
 * Extract content metadata from element attributes
 */
function extractMetadata(element: HTMLElement): ContentMetadata | null {
  const creatorAddress = element.getAttribute('data-yellowpay-creator');
  const priceStr = element.getAttribute('data-yellowpay-price');
  const asset = element.getAttribute('data-yellowpay-asset') || 'ytest.usd';
  const contentId = element.getAttribute('data-yellowpay-content-id');

  if (!creatorAddress || !priceStr || !contentId) {
    return null;
  }

  // Validate Ethereum address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(creatorAddress)) {
    console.error('❌ Invalid creator address format:', creatorAddress);
    return null;
  }

  const price = parseFloat(priceStr);
  if (isNaN(price) || price <= 0) {
    console.error('❌ Invalid price:', priceStr);
    return null;
  }

  return {
    contentId,
    creatorAddress,
    price,
    asset,
    title: element.getAttribute('data-yellowpay-title') || 'Premium Content',
    domain: window.location.hostname
  };
}

/**
 * Check if content is already unlocked
 */
async function checkUnlockStatus(
  contentId: string,
  element: HTMLElement,
  metadata: ContentMetadata
) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CHECK_UNLOCK_STATUS',
      data: { contentId, domain: window.location.hostname }
    });

    if (response.success && response.unlocked) {
      console.log('✅ Content already unlocked:', contentId);
      unlockContent(contentId, element, false);
    } else {
      // Not unlocked, inject unlock UI
      injectUnlockUI(contentId, element, metadata);
    }
  } catch (error) {
    console.error('❌ Failed to check unlock status:', error);
    // Fallback: show unlock UI
    injectUnlockUI(contentId, element, metadata);
  }
}

/**
 * Inject unlock button and overlay
 */
function injectUnlockUI(
  contentId: string,
  element: HTMLElement,
  metadata: ContentMetadata
) {
  // Apply blur effect if not already present
  if (!element.style.filter.includes('blur')) {
    element.style.filter = 'blur(10px)';
    element.style.userSelect = 'none';
    element.style.pointerEvents = 'none';
  }

  // Create overlay container
  const overlay = document.createElement('div');
  overlay.className = 'yellowpay-overlay';
  overlay.setAttribute('data-yellowpay-overlay', contentId);
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    z-index: 9999;
    pointer-events: all;
  `;

  // Create unlock button
  const button = document.createElement('button');
  button.className = 'yellowpay-unlock-btn';
  button.innerHTML = `
    <div style="text-align: center; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
      <div style="font-size: 24px; margin-bottom: 10px;">🔒</div>
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px; color: #333;">
        ${metadata.title}
      </div>
      <div style="font-size: 14px; color: #666; margin-bottom: 16px;">
        Unlock for ${metadata.price} ${metadata.asset.toUpperCase()}
      </div>
      <div style="background: #FDB022; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: background 0.2s;">
        Unlock with YellowPay
      </div>
    </div>
  `;

  button.onclick = () => handleUnlockClick(contentId, metadata);

  overlay.appendChild(button);

  // Position overlay relative to element
  const parent = element.parentElement;
  if (parent) {
    parent.style.position = 'relative';
    parent.appendChild(overlay);
  }

  console.log('💡 Unlock UI injected for:', contentId);
}

/**
 * Handle unlock button click
 */
async function handleUnlockClick(contentId: string, metadata: ContentMetadata) {
  console.log('🔓 Unlock requested for:', contentId);

  try {
    // Send unlock request to background script
    const response = await chrome.runtime.sendMessage({
      type: 'REQUEST_UNLOCK',
      data: {
        contentId: metadata.contentId,
        creatorAddress: metadata.creatorAddress,
        price: metadata.price,
        asset: metadata.asset,
        domain: metadata.domain,
        title: metadata.title
      }
    });

    if (response.success) {
      console.log('✅ Unlock successful:', contentId);
      const element = paywallElements.get(contentId);
      if (element) {
        unlockContent(contentId, element, false);
      }
    } else {
      console.error('❌ Unlock failed:', response.error);
      showError(contentId, response.error || 'Unlock failed');
    }
  } catch (error) {
    console.error('❌ Unlock request error:', error);
    showError(contentId, 'Failed to communicate with extension');
  }
}

/**
 * Unlock content (remove blur and overlay)
 */
function unlockContent(contentId: string, element: HTMLElement, isCreator: boolean) {
  // Remove blur
  element.style.filter = 'none';
  element.style.userSelect = 'auto';
  element.style.pointerEvents = 'auto';

  // Remove overlay
  const overlay = document.querySelector(`[data-yellowpay-overlay="${contentId}"]`);
  if (overlay) {
    overlay.remove();
  }

  // Show success indicator
  if (!isCreator) {
    showSuccessIndicator(element);
  }

  console.log('🎉 Content unlocked:', contentId);
}

/**
 * Show success indicator
 */
function showSuccessIndicator(element: HTMLElement) {
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10B981;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
    animation: slideIn 0.3s ease-out;
  `;
  indicator.textContent = '✅ Content unlocked successfully!';

  document.body.appendChild(indicator);

  setTimeout(() => {
    indicator.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => indicator.remove(), 300);
  }, 3000);
}

/**
 * Show error message
 */
function showError(contentId: string, message: string) {
  const overlay = document.querySelector(`[data-yellowpay-overlay="${contentId}"]`);
  if (!overlay) return;

  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #EF4444;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  errorDiv.textContent = '❌ ' + message;

  overlay.appendChild(errorDiv);

  setTimeout(() => errorDiv.remove(), 5000);
}

/**
 * Observe DOM for dynamically added content
 */
function observeDOM() {
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;

    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          if (node.hasAttribute('data-yellowpay-blur') ||
              node.querySelector('[data-yellowpay-blur]')) {
            shouldScan = true;
          }
        }
      });
    });

    if (shouldScan) {
      console.log('🔄 New content detected, rescanning...');
      scanForPaywalls();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Handle messages from background script
 */
function handleBackgroundMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) {
  if (message.type === 'UNLOCK_CONFIRMED') {
    const { contentId } = message.data;
    const element = paywallElements.get(contentId);

    if (element) {
      unlockContent(contentId, element, false);
    }

    sendResponse({ success: true });
  }

  return true; // Keep message channel open
}
