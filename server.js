import express from "express";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { chromium } from "playwright";
import { getAccessToken } from "./src/auth.js";
import { getRfsItems } from "./src/mcp.js";
import { processItem } from "./src/senukai.js";
import { CONFIG } from "./src/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "client/dist")));

let sseClients = [];
let isRunning = false;
let lastReport = null;

function broadcast(data) {
  sseClients.forEach((res) => res.write(`data: ${JSON.stringify(data)}\n\n`));
}

function log(message, type = "info") {
  console.log(message);
  broadcast({ type: "log", message, logType: type });
}

async function clearCart(page) {
  await page.goto("https://www.senukai.lt/cart", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2000);
  while (true) {
    const removeBtn = page.locator('button[aria-label="remove"]').first();
    if ((await removeBtn.count()) === 0) break;
    await removeBtn.click();
    await page.waitForTimeout(1000);
  }
}

app.get("/api/logs", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  sseClients.push(res);
  req.on("close", () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

app.get("/api/status", (req, res) => {
  res.json({ isRunning, lastReport });
});

app.post("/api/run", async (req, res) => {
  if (isRunning) {
    return res.status(409).json({ error: "Automation already running" });
  }
  const rfsId = req.body?.rfsId || CONFIG.rfsId;
  if (!rfsId) {
    return res.status(400).json({ error: "RFS ID is required" });
  }
  isRunning = true;
  lastReport = null;
  res.json({ started: true });

  const report = { added: [], skipped: [] };

  try {
    log("🚀 Starting automation...", "start");
    log("🔐 Authenticating to OMS...", "info");
    const { accessToken } = await getAccessToken();
    log("✅ Authenticated", "success");

    log(`📋 Fetching RFS ${rfsId}...`, "info");
    const items = await getRfsItems(accessToken, rfsId);
    log(`✅ Found ${items.length} items to process`, "success");

    log("🌐 Launching browser...", "info");
    const browser = await chromium.launch({
      headless: false,
      channel: "chrome",
      args: ["--disable-blink-features=AutomationControlled"],
    });
    const page = await browser.newPage();

    log("🗑️ Clearing cart...", "info");
    await clearCart(page);
    log("✅ Cart cleared", "success");

    for (const item of items) {
      log(`\n🔍 Searching EAN: ${item.ean}`, "info");
      log(`   Product: ${item.title}`, "info");
      log(`   Quantity needed: ${item.quantity_needed}`, "info");
      await processItem(page, item.ean, item.quantity_needed, report, log);
    }

    await page.goto("https://www.senukai.lt/cart", {
      waitUntil: "domcontentloaded",
    });
    log("\n✅ Automation complete! Cart is open in the browser.", "success");
    lastReport = report;
    broadcast({ type: "done", report });
  } catch (err) {
    log(`❌ Error: ${err.message}`, "error");
    broadcast({ type: "error", message: err.message });
  } finally {
    isRunning = false;
  }
});

app.get("/{*path}", (req, res) => {
  res.sendFile(join(__dirname, "client/dist/index.html"));
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
});
