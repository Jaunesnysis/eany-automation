import { CONFIG } from "./config.js";

async function waitForCloudflare(page) {
  if (
    (await page.locator("text=Potwierdź").count()) > 0 ||
    (await page.locator("text=checking").count()) > 0
  ) {
    console.log("  ⏳ Cloudflare check — waiting...");
    await page.waitForTimeout(8000);
  }
}

async function getUkmergesStock(page) {
  const showAllBtn = page.locator("text=Žiūrėti visus likučius");
  if ((await showAllBtn.count()) > 0) {
    await showAllBtn.click();
    await page.waitForTimeout(1500);
  }

  const ukmergesRow = page.locator(`text=${CONFIG.ukmergesKeyword}`).first();
  if ((await ukmergesRow.count()) === 0) return 0;

  const rowText = await ukmergesRow.evaluate((el) => {
    let node = el;
    for (let i = 0; i < 6; i++) {
      node = node.parentElement;
      if (!node) break;
      const text = node.innerText;
      if (text && text.match(/\d+\s*vnt/)) return text;
    }
    return "";
  });

  const match = rowText.match(/(\d+)\s*vnt/);
  return match ? parseInt(match[1]) : 0;
}

export async function processItem(
  page,
  ean,
  quantityNeeded,
  report,
  log = console.log,
) {
  // Search by EAN — use a fresh page to avoid stale DOM
  await page.goto("about:blank");
  await page.waitForTimeout(500);
  await page.goto(`${CONFIG.senukaiUrl}/paieska?q=${ean}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(4000);
  await waitForCloudflare(page);

  // Get all product links and prefer search result ones
  const allLinks = await page.locator('a[href*="/p/"]').all();
  const hrefs = await Promise.all(allLinks.map((l) => l.getAttribute("href")));
  const uniqueHrefs = [...new Set(hrefs.filter((h) => h && h.includes("/p/")))];
  const productUrl =
    uniqueHrefs.find((h) => h.includes("mtd=searchPage")) || uniqueHrefs[0];

  if (!productUrl) {
    log(`  ❌ Not found on Senukai`, "error");
    report.skipped.push({ ean, reason: "Not found on Senukai" });
    return;
  }

  const noResults =
    (await page.locator("text=Nieko nerasta").count()) > 0 ||
    (await page.locator("text=nerasta").count()) > 0 ||
    uniqueHrefs.length === 0;

  if (noResults) {
    log(`  ❌ No search results for EAN ${ean}`, "error");
    report.skipped.push({ ean, reason: "Not found on Senukai" });
    return;
  }

  // Navigate to product page
  const fullUrl = productUrl.startsWith("http")
    ? productUrl
    : `${CONFIG.senukaiUrl}${productUrl.startsWith("/") ? "" : "/"}${productUrl}`;

  await page.goto(fullUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await waitForCloudflare(page);

  const pageContent = await page.content();
  if (!pageContent.includes(ean)) {
    log(
      `  ❌ EAN ${ean} not found on product page — wrong product returned`,
      "error",
    );
    report.skipped.push({
      ean,
      reason: "EAN mismatch — wrong product returned by search",
    });
    return;
  }

  const productTitle = (await page.title()).split("|")[0].trim();
  log(`  📦 Found: ${productTitle}`, "info");

  // Accept cookies if banner present
  const cookieBtn = page.locator(
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  );
  if ((await cookieBtn.count()) > 0) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Check Ukmergės g. stock
  const ukmergesStock = await getUkmergesStock(page);
  log(`  🏪 Ukmergės g. stock: ${ukmergesStock} units`, "info");

  if (ukmergesStock === 0) {
    log(`  ⏭️  Skipping — no stock at Ukmergės g.`, "warning");
    report.skipped.push({ ean, reason: "No stock at Ukmergės g." });
    return;
  }

  const quantityToAdd = Math.min(quantityNeeded, ukmergesStock);
  if (quantityToAdd < quantityNeeded) {
    log(
      `  ⚠️  Capped: need ${quantityNeeded}, adding ${quantityToAdd}`,
      "warning",
    );
  }

  // Close store drawer if open
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // Set quantity
  // Set quantity by clicking + button multiple times
  const plusBtn = page.locator('button[aria-label="increment"]').first();
  if ((await plusBtn.count()) > 0) {
    // Click + (quantityToAdd - 1) times since default is 1
    for (let i = 1; i < quantityToAdd; i++) {
      await plusBtn.click();
      await page.waitForTimeout(300);
    }
  } else {
    // Fallback: try direct input
    const qtyInput = page.locator('input[type="number"]').first();
    if ((await qtyInput.count()) > 0) {
      await qtyInput.click({ clickCount: 3 });
      await qtyInput.type(String(quantityToAdd));
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
    }
  }

  // Add to cart
  const addToCartBtn = page.locator('button:has-text("Į krepšelį")').first();
  if ((await addToCartBtn.count()) === 0) {
    log(`  ❌ Add to cart button not found`, "error");
    report.skipped.push({ ean, reason: "Add to cart button not found" });
    return;
  }

  await addToCartBtn.click();
  await page.waitForTimeout(3000);

  // Close post-add-to-cart drawer
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.goto(`${CONFIG.senukaiUrl}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  log(`  ✅ Added ${quantityToAdd} unit(s) to cart`, "success");
  report.added.push({
    ean,
    title: productTitle,
    added: quantityToAdd,
    needed: quantityNeeded,
    capped: quantityToAdd < quantityNeeded,
  });
}
