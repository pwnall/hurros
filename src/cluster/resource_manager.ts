import * as puppeteer from 'puppeteer';
import { clearTimeout, setTimeout } from 'timers';

import PagePool from './page_pool';

// Concrete implementation of a page pool.
export default class ResourceManager implements PagePool {
  constructor() {
    this.browsers_ = [];
    this.queue_ = [];
    this.allPages_ = new Set<puppeteer.Page>();
    this.freePages_ = [];
    this.shuttingDown_ = false;
  }

  // Checks out a Chrome tab from the pool for the given async function.
  //
  // When the function returns or throws, the tab is checked back into the pool.
  // The function's return / throw value is passed to the caller.
  async withPage<T>(f : (page: puppeteer.Page) => Promise<T>) : Promise<T> {
    if (this.shuttingDown_)
      throw new Error("PagePool shut down");

    const page = await this.checkoutPage();
    try {
      const returnValue : T = await f(page);
      return returnValue;
    } finally {
      this.checkinPage(page);
    }
  }

  async shutdown() : Promise<void> {
    this.shuttingDown_ = true;

    for (let queueItem of this.queue_) {
      try {
        queueItem(null);
      } catch(e) {
        console.error(`PagePool callback error: ${e}`);
      }
    }
    this.queue_ = null;

    for (let browser of this.browsers_) {
      try {
        browser.close();
      } catch(e) {
        console.error(`PagePool browser closing error: ${e}`);
      }
    }

    this.browsers_ = null;
    this.allPages_.clear();
    this.freePages_ = [];
  }

  // Starts a local browser and adds its pages to the pool.
  async launchBrowser(maxPages : number = 1) : Promise<void> {
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--disable-notifications'],
    });

    await this.addBrowser(browser, maxPages);
  }

  // Connects to a remote browser and adds it to the pool.
  connectBrowser(wsUrl : string, maxPages : number = 1) : Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = 30 * 1000;  // 30 seconds
      let connected = false;
      let timedOut = false;

      const timeoutHandler = setTimeout(() => {
        if (connected)
          return;

        timedOut = true;
        reject(new Error(`Timed out while connecting to ${wsUrl}`));
      }, timeout);

      puppeteer.connect({
        browserWSEndpoint: wsUrl,
      }).then((browser) => {
        connected = true;
        if (timedOut)
          return;

        clearTimeout(timeoutHandler);
        resolve(this.addBrowser(browser, maxPages));
      }).catch(reject);
    });
  }

  // Number of pages available in the pool.
  pageCount() : number {
    if (this.shuttingDown_)
      throw new Error("PagePool shut down");
    return this.allPages_.size;
  }

  pageWsUrls() : string[] {
    const urls : string[] = [];
    for (let page of this.allPages_) {
      // TODO(pwnall): Try to get the URL exposed in the API.
      //     Path: Page._client -> Session._connection -> Connection.url()
      urls.push((page as any)._client._connection.url());
    }
    return urls;
  }

  queueSize() : number {
    if (this.shuttingDown_)
      throw new Error("PagePool shut down");
    return this.queue_.length;
  }

  private checkoutPage() : Promise<puppeteer.Page> {
    if (this.shuttingDown_)
      return Promise.resolve(null);

    if (this.freePages_.length > 0) {
      const page = this.freePages_.pop();
      return Promise.resolve(page);
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

    this.freePages_.push(page);
  }

  // Adds a browser to this pool.
  private async addBrowser(browser : puppeteer.Browser, maxPages : number)
      : Promise<void> {
    const pages : Array<puppeteer.Page> = await browser.pages();
    while (pages.length < maxPages)
      pages.push(await browser.newPage());

    await Promise.all(pages.map((page) => this.initializePage(page)));

    if (this.shuttingDown_) {
      browser.close();
      return;
    }
    this.browsers_.push(browser);
    for (let page of pages) {
      this.allPages_.add(page);
      this.checkinPage(page);
    }
  }

  // Sets up a Chrome page right before it is added to the pool.
  private async initializePage(page : puppeteer.Page) : Promise<void> {
    // Viewport setting is optional, but it makes debugging a tad better.
    await page.setViewport({width: 1024, height: 768});
  }

  private browsers_ : puppeteer.Browser[];
  private allPages_ : Set<puppeteer.Page>;
  private freePages_ : Array<puppeteer.Page>;
  private shuttingDown_ : boolean;

  // Chain of promises, where each promise is resolved when a page is freed.
  private queue_ : Array<(page : puppeteer.Page) => void>;
}
