/**
 * YellowPay Popup Script
 *
 * Responsibilities:
 * - Display unified balance
 * - Show authentication status
 * - Handle "Activate Extension" button
 * - Display recent unlocks
 * - Provide access to settings and creator mode
 */

import type { UnlockRecord } from './types';

// DOM Elements
let balanceAmount: HTMLElement;
let balanceAsset: HTMLElement;
let statusDot: HTMLElement;
let statusText: HTMLElement;
let statusSpinner: HTMLElement;
let actionButton: HTMLButtonElement;
let buttonText: HTMLElement;
let activityList: HTMLElement;
let emptyState: HTMLElement;
let settingsLink: HTMLElement;
let creatorModeLink: HTMLElement;

// State
let isAuthenticated = false;
let currentBalance = '0.00';

console.log('🟡 YellowPay popup loaded');

/**
 * Initialize popup
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  balanceAmount = document.getElementById('balanceAmount')!;
  balanceAsset = document.getElementById('balanceAsset')!;
  statusDot = document.getElementById('statusDot')!;
  statusText = document.getElementById('statusText')!;
  statusSpinner = document.getElementById('statusSpinner')!;
  actionButton = document.getElementById('actionButton') as HTMLButtonElement;
  buttonText = document.getElementById('buttonText')!;
  activityList = document.getElementById('activityList')!;
  emptyState = document.getElementById('emptyState')!;
  settingsLink = document.getElementById('settingsLink')!;
  creatorModeLink = document.getElementById('creatorModeLink')!;

  // Setup event listeners
  actionButton.addEventListener('click', handleActionButtonClick);
  settingsLink.addEventListener('click', openSettings);
  creatorModeLink.addEventListener('click', openCreatorMode);

  // Load initial data
  await checkAuthenticationStatus();
  await loadBalance();
  await loadRecentActivity();
});

/**
 * Check if user is authenticated
 */
async function checkAuthenticationStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SESSION'
    });

    if (response.success && response.authenticated) {
      isAuthenticated = true;
      updateStatus('connected', 'Connected to Yellow Network');
      updateActionButton('authenticated');
    } else {
      isAuthenticated = false;
      updateStatus('disconnected', 'Not authenticated');
      updateActionButton('not-authenticated');
    }

  } catch (error) {
    console.error('❌ Failed to check auth status:', error);
    updateStatus('error', 'Connection error');
    updateActionButton('error');
  } finally {
    statusSpinner.classList.add('hidden');
  }
}

/**
 * Update status indicator
 */
function updateStatus(status: 'connected' | 'disconnected' | 'error', text: string) {
  statusText.textContent = text;

  statusDot.className = 'status-dot';
  if (status === 'connected') {
    statusDot.classList.add('connected');
  }
}

/**
 * Update action button state
 */
function updateActionButton(state: 'authenticated' | 'not-authenticated' | 'error') {
  actionButton.disabled = false;

  switch (state) {
    case 'authenticated':
      buttonText.textContent = '✅ Extension Active';
      actionButton.disabled = true;
      break;
    case 'not-authenticated':
      buttonText.textContent = '🔐 Activate Extension';
      break;
    case 'error':
      buttonText.textContent = '⚠️ Connection Error';
      actionButton.disabled = true;
      break;
  }
}

/**
 * Load balance from background script
 */
async function loadBalance() {
  if (!isAuthenticated) {
    balanceAmount.textContent = '--';
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CHECK_BALANCE',
      data: { asset: 'ytest.usd' }
    });

    if (response.success && response.balance) {
      currentBalance = response.balance;
      balanceAmount.textContent = formatBalance(response.balance);
      balanceAsset.textContent = response.asset || 'ytest.usd';
    } else {
      balanceAmount.textContent = '0.00';
    }

  } catch (error) {
    console.error('❌ Failed to load balance:', error);
    balanceAmount.textContent = '--';
  }
}

/**
 * Load recent activity from storage
 */
async function loadRecentActivity() {
  try {
    const result = await chrome.storage.local.get(['purchases']);

    if (!result.purchases) {
      showEmptyState();
      return;
    }

    // Flatten all purchases from all domains
    const allUnlocks: Array<{ domain: string; contentId: string; record: UnlockRecord }> = [];

    Object.entries(result.purchases).forEach(([domain, contentMap]: [string, any]) => {
      Object.entries(contentMap).forEach(([contentId, record]: [string, any]) => {
        allUnlocks.push({ domain, contentId, record });
      });
    });

    // Sort by date (newest first)
    allUnlocks.sort((a, b) => b.record.unlockedAt - a.record.unlockedAt);

    // Take last 5
    const recentUnlocks = allUnlocks.slice(0, 5);

    if (recentUnlocks.length === 0) {
      showEmptyState();
      return;
    }

    // Render activity items
    activityList.innerHTML = '';
    recentUnlocks.forEach(({ domain, record }) => {
      const item = createActivityItem(domain, record);
      activityList.appendChild(item);
    });

    emptyState.classList.add('hidden');

  } catch (error) {
    console.error('❌ Failed to load recent activity:', error);
    showEmptyState();
  }
}

/**
 * Create activity item element
 */
function createActivityItem(domain: string, record: UnlockRecord): HTMLElement {
  const item = document.createElement('div');
  item.className = 'activity-item';

  const title = document.createElement('div');
  title.className = 'activity-title';
  title.textContent = `Unlocked content on ${domain}`;

  const meta = document.createElement('div');
  meta.className = 'activity-meta';

  const price = document.createElement('span');
  price.textContent = `${record.price} USD`;

  const date = document.createElement('span');
  date.textContent = formatRelativeTime(record.unlockedAt);

  meta.appendChild(price);
  meta.appendChild(date);

  item.appendChild(title);
  item.appendChild(meta);

  return item;
}

/**
 * Show empty state
 */
function showEmptyState() {
  activityList.innerHTML = '';
  emptyState.classList.remove('hidden');
}

/**
 * Handle action button click
 */
async function handleActionButtonClick() {
  if (isAuthenticated) {
    return; // Already authenticated
  }

  try {
    buttonText.textContent = 'Activating...';
    actionButton.disabled = true;

    // TODO: Implement full authentication flow in Phase 4
    // For now, just send authenticate message
    const response = await chrome.runtime.sendMessage({
      type: 'AUTHENTICATE',
      data: { password: 'temp-password' } // Will be replaced with proper password input
    });

    if (response.success) {
      isAuthenticated = true;
      updateStatus('connected', 'Connected to Yellow Network');
      updateActionButton('authenticated');
      await loadBalance();
    } else {
      throw new Error(response.error || 'Authentication failed');
    }

  } catch (error: any) {
    console.error('❌ Authentication failed:', error);
    alert('Authentication failed: ' + error.message);
    updateActionButton('not-authenticated');
  }
}

/**
 * Open settings page
 */
function openSettings(e: Event) {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
}

/**
 * Open creator mode (future feature)
 */
function openCreatorMode(e: Event) {
  e.preventDefault();
  // TODO: Implement in Step 2.9
  alert('Creator Mode coming soon in Phase 2.9!');
}

/**
 * Format balance with 2 decimals
 */
function formatBalance(balance: string): string {
  const num = parseFloat(balance);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}
