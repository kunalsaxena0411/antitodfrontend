const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/network-topology');
    await page.waitForTimeout(2000);
    // Find the add button next to Load Balancer
    const addBtns = await page.$$('button:has(svg.lucide-plus)');
    for (const btn of addBtns) {
        const text = await btn.evaluate(node => node.parentElement.innerText);
        if (text.includes('Load Balancer')) {
            await btn.click();
            break;
        }
    }
    await page.waitForTimeout(1000);
    const html = await page.$eval('.react-flow__renderer', el => el.outerHTML);
    console.log(html);
    await browser.close();
})();
