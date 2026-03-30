const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    console.error('PAGE ERROR', err.message);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('CONSOLE ERROR', msg.text());
    }
  });

  try {
    await page.goto('http://localhost:5174/scraper', { waitUntil: 'networkidle0' });
    console.log("Page loaded");
  } catch(e) {
    console.error("GOTO ERROR", e.message);
  }

  await browser.close();
})();
