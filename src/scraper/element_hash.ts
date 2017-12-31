import * as puppeteer from 'puppeteer';

// Computes a crypto hash of a DOM element's textContent.
//
// Using a hash instead of the full text is useful for change detection. In that
// case, shipping a large amount of text over a potentially slow network (when
// the scraping drones are remote) is undesirable and unnecessary.
export async function elementHash(page : puppeteer.Page, cssSelector : string)
    : Promise<string> {
  return await page.evaluate(async (selector : string) => {
    const element = document.querySelector(selector);
    const buffer = new TextEncoder('utf-8').encode(element.textContent);
    const hashArray = new Uint32Array(
        await crypto.subtle.digest('sha-256', buffer));
    return Array.from(hashArray).map(byte => byte.toString(26)).join(':');
  }, cssSelector);
}

// Waits until the textContent of a DOM element changes.
//
// The element's old hash should be computed by calling elementHash().
export async function waitForElementHashChange(
    page : puppeteer.Page, cssSelector : string, oldHash : string,
    timeoutMs : number = 10000) : Promise<string> {

  // We rely on the fact that the queue selection is only reflected when the
  // page is re-rendered using new data from the backend.
  return await page.evaluate(
      async (selector : string, hash : string, timeout : number) => {

    const timeOutAt = Date.now() + timeout;
    while (true) {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));

      const element = document.querySelector(selector);
      const buffer = new TextEncoder('utf-8').encode(element.textContent);
      const hashArray = new Uint32Array(
          await crypto.subtle.digest('sha-256', buffer));
      const newHash =
          Array.from(hashArray).map(byte => byte.toString(26)).join(':');
      if (newHash != hash)
        return newHash;

      if (timeOutAt < Date.now())
        throw new Error(`waiting failed: timeout ${timeout}ms exceeded`);
    }
  }, cssSelector, oldHash, timeoutMs);
}
