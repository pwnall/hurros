import * as puppeteer from 'puppeteer';

// Manages a Chrome instance and its tabs.
export default class PagePool {
  constructor(poolSize : number = 4) {
    this.poolSize_ = poolSize;
    this.browserPromise_ = this.launchBrowser();
    this.queue_ = [];
    this.allPages_ = new Set<puppeteer.Page>();
    this.free_pages_ = [];
  }

  // Checks out a Chrome tab from the pool for the given async function.
  //
  // When the function returns or throws, the tab is checked back into the pool.
  // The function's return / throw value is passed to the caller.
  async withPage<T>(f : (page: puppeteer.Page) => Promise<T>) : Promise<T> {
    const page = await this.checkoutPage();
    try {
      const returnValue : T = await f(page);
      return returnValue;
    } finally {
      this.checkinPage(page);
    }
  }

  async shutdown() : Promise<void> {
    await this.browserPromise_;

    for (let queueItem of this.queue_) {
      try {
        queueItem(null);
      } catch(e) {
        console.error(`PagePool callback error: ${e}`);
      }
    }
    this.queue_ = null;

    await this.browser_.close();
    this.browser_ = null;
    this.browserPromise_ = null;
  }

  private checkoutPage() : Promise<puppeteer.Page> {
    if (this.free_pages_.length > 0) {
      const page = this.free_pages_.pop();
      return Promise.resolve(page);
    }

    if (this.allPages_.size < this.poolSize_) {
      this.browserPromise_ = this.browserPromise_.then(async () => {
        if (this.allPages_.size >= this.poolSize_)
          return;

        const page = await this.browser_.newPage();
        // Viewport setting is optional, but it makes debugging a tad better.
        await page.setViewport({width: 1024, height: 768});
        this.allPages_.add(page);
        this.checkinPage(page);
      });
    }

    return new Promise((resolve) => { this.queue_.push(resolve); });
  }

  private checkinPage(page : puppeteer.Page) : void {
    if (this.queue_.length > 0) {
      const queueItem = this.queue_.pop();
      try {
        queueItem(page);
      } catch (e) {
        console.error(`PagePool callback error: ${e}`);
      }
      return;
    }

    if (this.allPages_.size > this.poolSize_) {
      this.allPages_.delete(page);
      return;
    }

    this.free_pages_.push(page);
  }

  // Starts a browser instance and populates browser_ and pages_.
  private async launchBrowser() : Promise<void> {
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--disable-notifications'],
    });
    const pages = await browser.pages();

    this.browser_ = browser;
    for (let page of pages) {
      // Viewport setting is optional, but it makes debugging a tad better.
      await page.setViewport({width: 1024, height: 768});
      this.allPages_.add(page);
      this.checkinPage(page);
    }
  }

  private browserPromise_ : Promise<void>;
  // Can be null until browserPromise_ is resolved.
  private browser_ : puppeteer.Browser | null;
  // Can be null until browserPromise_ is resolved.
  private allPages_ : Set<puppeteer.Page> | null;
  // Can be null until browserPromise_ is resolved.
  private free_pages_ : Array<puppeteer.Page> | null;
  // Maximum number of tabs that can be opened in the browser.
  private poolSize_ : number;
  // Chain of promises, where each promise is resolved when a page is freed.
  private queue_ : Array<(page : puppeteer.Page) => void>;
}
