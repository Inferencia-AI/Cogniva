import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';

export async function getTitle(): Promise<string | null> {
    // Optional chromium configuration (cast to any to avoid type errors if needed)
    (chromium as any).setHeadlessMode = true; // "new" headless mode is default; set to false if needed
    (chromium as any).setGraphicsMode = false; // disable webgl (true by default)

    const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: true,
    });

    const page = await browser.newPage();

    try {
        // Navigate to the page and set viewport.
        await page.goto('https://developer.chrome.com/');
        await page.setViewport({ width: 1080, height: 1024 });

        // Open search and type query.
        await page.keyboard.press('/');
        const searchSelector = 'input[aria-label="Search"], input[type="search"], input.devsite-searchbox-input';
        await page.waitForSelector(searchSelector, { visible: true });
        await page.type(searchSelector, 'automate beyond recorder');

        // Click first result and wait for navigation.
        await page.waitForSelector('.devsite-result-item-link', { visible: true });
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('.devsite-result-item-link'),
        ]);

        // Read the page title (h1 is used on devsite article pages).
        const titleSelector = 'h1';
        await page.waitForSelector(titleSelector, { visible: true });
        const fullTitle = await page.$eval(titleSelector, el => el.textContent?.trim() ?? null);

        return fullTitle;
    } finally {
        await browser.close();
    }
}