// Popup Script
console.log('YellowPay popup loaded');

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <header style="text-align: center; padding: 20px;">
        <h1 style="color: #FFD700; margin: 0;">⚡ YellowPay</h1>
        <p style="color: #666; margin-top: 8px;">Content Micropayments</p>
      </header>
      <div style="padding: 16px;">
        <p style="text-align: center;">Extension is ready!</p>
        <p style="text-align: center; font-size: 12px; color: #999;">Phase 1 setup complete</p>
      </div>
    `;
  }
});
