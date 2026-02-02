# YellowPay Chrome Extension

Chrome Extension for instant, zero-gas micropayments using Yellow Network.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` file:

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Build the extension:

```bash
npm run build
```

4. Load in Chrome:

- Open `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `dist/` folder

## Development

Watch mode for development:

```bash
npm run dev
```

## Project Status

✅ Phase 0: Project Setup Complete

- Project structure created
- Build system configured
- Manifest V3 ready
- Placeholder files created

Next: Phase 1 - Yellow SDK Integration & Auth
