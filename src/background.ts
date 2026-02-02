// Background Service Worker
console.log('YellowPay background service worker loaded');

chrome.runtime.onInstalled.addListener(() => {
  console.log('YellowPay extension installed');
});

// Placeholder for message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  sendResponse({ status: 'ok' });
  return true;
});
