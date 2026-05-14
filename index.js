import { chromium } from "playwright";
import { getAccessToken } from "./src/auth.js";
import { getRfsItems } from "./src/mcp.js";
import { processItem } from "./src/senukai.js";
import { printReport } from "./src/report.js";
import { CONFIG } from "./src/config.js";

async function main() {
  console.log("🚀 Eany RFS → Senukai Cart Automation\n");

  // 1. Authenticate
  const { accessToken } = await getAccessToken();

  // 2. Fetch RFS items from OMS
  const items = await getRfsItems(accessToken, CONFIG.rfsId);
  console.log(`\n📦 Processing ${items.length} items...\n`);

  // 3. Launch browser
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = await browser.newPage();

  const report = { added: [], skipped: [] };

  // 4. Process each item on Senukai
  for (const item of items) {
    await processItem(page, item.ean, item.quantity_needed, report);
  }

  // 5. Print report
  printReport(report);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
