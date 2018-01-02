import * as puppeteer from 'puppeteer';
import { clearTimeout, setTimeout } from 'timers';

import { PoolPriority } from './pool_priority';

// State stored for each page in the pool.
interface ManagedPageInfo {
  lastCheckedOutAt: number,
  lastCheckedInAt: number,
  lastTaskDuration: number,
  lastError: Error | null,
  taskPriority: PoolPriority,
};

// Stated stored for each queued withPage() request.
interface QueuedRequest {
  priority: PoolPriority,
  callback: (page : puppeteer.Page) => void;
}

// Concrete implementation of a page pool.
export default class ResourceManager {
  constructor() {
    this.browsers_ = [];
    this.queues_ = [];
    for (let i = 0; i < PoolPriority.Invalid; ++i)
      this.queues_.push([]);
    this.pageInfo_ = new Map<puppeteer.Page, ManagedPageInfo>();
    this.freePages_ = [];
    this.shuttingDown_ = false;
  }

  // Checks out a Chrome tab from the pool for the given async function.
  //
  // When the function returns or throws, the tab is checked back into the pool.
  // The function's return / throw value is passed to the caller.
  async withPage<T>(priority : PoolPriority,
                    f : (page: puppeteer.Page) => Promise<T>) : Promise<T> {
    if (this.shuttingDown_)
      throw new Error("PagePool shut down");

    const page = await this.checkoutPage(priority);
    const pageInfo = this.pageInfo_.get(page);
    const startedAt = Date.now();
    try {
      const returnValue : T = await f(page);
      return returnValue;
    } catch (e) {
      pageInfo.lastError = e;
      throw e;
    } finally {
      const endedAt = Date.now();
      pageInfo.lastTaskDuration = endedAt - startedAt;
      this.checkinPage(page);
    }
  }

  async shutdown() : Promise<void> {
    this.shuttingDown_ = true;

    for (let queue of this.queues_) {
      for (let queueItem of queue) {
        try {
          queueItem.callback(null);
        } catch(e) {
          console.error(`PagePool callback error: ${e}`);
        }
      }
    }
    this.queues_ = null;

    for (let browser of this.browsers_) {
      try {
        browser.close();
      } catch(e) {
        console.error(`PagePool browser closing error: ${e}`);
      }
    }

    this.browsers_ = null;
    this.pageInfo_.clear();
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
    return this.pageInfo_.size;
  }

  // Number of pages that are free in the pool.
  freePageCount() : number {
    return this.freePages_.length;
  }

  // The size of the pending task queue at each priority level.
  //
  // Swelling queue sizes may indicate a job leak.
  queueSizes() : { [queueName: string]: number } {
    if (this.shuttingDown_)
      throw new Error("PagePool shut down");

    const sizes : { [ queueName : string]: number } = {};
    for (let i = 0; i < this.queues_.length; ++i)
      sizes[PoolPriority[i]] = this.queues_[i].length;

    return sizes;
  }

  // Debugging information about each managed Chrome resource.
  pageInfo() : { [wsUrl: string]: { [key: string]: any } } {
    const result : { [wsUrl: string]: { [key: string]: any } } = {};
    const now = Date.now();
    for (let [ page, pageInfo ] of this.pageInfo_) {
      // TODO(pwnall): Try to get the URL exposed in the API.
      //     Path: Page._client -> Session._connection -> Connection.url()
      const pageWsUrl = (page as any)._client._connection.url();
      result[pageWsUrl] = {
        lastCheckedInAgo: (now - pageInfo.lastCheckedInAt) / 1000.0,
        lastCheckedOutAgo: (now - pageInfo.lastCheckedOutAt) / 1000.0,
        lastDuration: pageInfo.lastTaskDuration / 1000.0,
        lastErrorMessage: pageInfo.lastError && pageInfo.lastError.message,
        taskPriority: PoolPriority[pageInfo.taskPriority],
      };
    }
    return result;
  }

  private checkoutPage(priority : PoolPriority) : Promise<puppeteer.Page> {
    if (this.shuttingDown_)
      return Promise.resolve(null);

    const now = Date.now();
    if (this.freePages_.length > 0) {
      const page = this.freePages_.pop();
      const pageInfo = this.pageInfo_.get(page);
      pageInfo.lastCheckedOutAt = now;
      pageInfo.taskPriority = priority;
      return Promise.resolve(page);
    }

    return new Promise((resolve) => {
      this.queues_[priority].push({
        callback: resolve,
        priority: priority,
      });
    });
  }

  private checkinPage(page : puppeteer.Page) : void {
    const now = Date.now();
    const pageInfo = this.pageInfo_.get(page);
    pageInfo.lastCheckedInAt = now;

    for (let i = 0; i < this.queues_.length; ++i) {
      const queue = this.queues_[i];

      if (queue.length > 0) {
        const queueItem = queue.pop();
        pageInfo.lastCheckedOutAt = now;
        pageInfo.taskPriority = queueItem.priority;

        try {
          queueItem.callback(page);
        } catch (e) {
          console.error(`PagePool callback error: ${e}`);
        }

        return;
      }
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
      this.pageInfo_.set(page, {
        lastCheckedOutAt: 0,
        lastCheckedInAt: 0,   // Will be overwritten by checkinPage.
        lastTaskDuration: 0,
        lastError: null,
        taskPriority: PoolPriority.Invalid,
      });
      this.checkinPage(page);
    }
  }

  // Sets up a Chrome page right before it is added to the pool.
  private async initializePage(page : puppeteer.Page) : Promise<void> {
    // Viewport setting is optional, but it makes debugging a tad better.
    await page.setViewport({width: 1024, height: 768});
  }

  private browsers_ : puppeteer.Browser[];
  private pageInfo_ : Map<puppeteer.Page, ManagedPageInfo>;
  private freePages_ : Array<puppeteer.Page>;
  private shuttingDown_ : boolean;

  // Chains of promises, where each promise is resolved when a page is freed.
  //
  // The manager has one chain per PoolPriority level.
  private queues_ : QueuedRequest[][];
}
