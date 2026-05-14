# Eany RFS Automation

Automates supplier cart filling on [senukai.lt](https://www.senukai.lt) from a Request-for-Supplier (RFS) in the eany OMS. The purchaser enters an RFS ID, clicks Run, and the automation finds each item by EAN, checks stock at the Ukmergės g. store, and adds the correct quantity to the cart. The browser opens at the end with the filled cart — the purchaser reviews and completes the order manually.

---

## Prerequisites

- Node.js 18 or higher
- npm

---

## Setup

**1. Clone the repository**

```bash
git clone <your-repo-url>
cd eany-automation
```

**2. Install server dependencies**

```bash
npm install
```

**3. Install and build the frontend**

```bash
cd client
npm install
npm run build
cd ..
```

---

## Running

```bash
node server.js
```

Then open [http://localhost:3001](http://localhost:3001) in your browser.

---

## Usage

1. The RFS ID field is pre-filled with the default (`EANY-ETKBUIDF`) — change it if needed
2. Click **Run automation**
3. Watch the live log as the automation runs
4. When complete, the Senukai cart opens automatically in your browser
5. Review the cart and complete the order manually — the automation never proceeds to checkout

---

## Inventory rule

Only items available at the **Ukmergės g.** Senukai store are added to the cart.

| Situation                           | Behaviour                             |
| ----------------------------------- | ------------------------------------- |
| Ukmergės g. has enough stock        | Adds the requested quantity           |
| Ukmergės g. has less than requested | Adds available stock, flags as capped |
| Ukmergės g. has 0 stock             | Skips the item, reports it            |
| Item not found on Senukai by EAN    | Skips the item, reports it            |
| EAN search returns wrong product    | Skips the item, reports it            |

All skipped items appear in the report after the run with a reason.

---

## Project structure

```
eany-automation/
├── server.js          # Express server, automation orchestrator
├── src/
│   ├── auth.js        # OAuth2 + PKCE authentication to OMS
│   ├── mcp.js         # OMS MCP client — fetches RFS items
│   ├── senukai.js     # Playwright automation — search, stock check, add to cart
│   ├── config.js      # URLs, RFS ID, store keyword
│   └── report.js      # Report formatting
├── client/            # React frontend (Vite)
│   └── src/
│       └── App.jsx
└── tokens.json        # Cached OAuth tokens (auto-generated, do not commit)
```

---

## How it works

1. **Auth** — authenticates to the OMS via OAuth2 with PKCE, caches the token locally, refreshes automatically when expired
2. **Fetch RFS** — calls the OMS MCP server to get the line items and quantities for the given RFS ID
3. **Browser automation** — launches a Playwright browser, clears the Senukai cart, then for each item:
   - Searches Senukai by EAN
   - Verifies the correct product was returned
   - Checks Ukmergės g. stock
   - Adds the capped quantity to the cart
4. **Handoff** — closes the automation browser, opens the cart in the user's default browser for manual review

---

## Cost per run

This automation uses no LLM or AI API calls — it is pure browser automation via Playwright.

| Component          | Cost                        |
| ------------------ | --------------------------- |
| OMS MCP calls      | Free (internal staging API) |
| Senukai requests   | Free (public website)       |
| Playwright browser | Free (local compute only)   |
| **Total per run**  | **~€0.00**                  |

At 1–3 runs per day across a typical RFS of 5–15 items, runtime is approximately 2–4 minutes per run. At 10x volume (50+ items), cost remains zero — only runtime increases linearly.

---

## Notes

- `tokens.json` is auto-generated on first run and stores the cached OAuth token.
- The automation runs with a visible browser by default so the purchaser can see progress. This can be switched to headless in `server.js` if preferred.
