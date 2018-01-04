import { clearTimeout, setTimeout } from 'timers';

import * as puppeteer from 'puppeteer';

import { isRateLimitedError, isTemporaryError } from './errors';
import { PoolPriority } from './pool_priority';
import { PageFunction } from './page_pool';

// State stored for exponentially backing off in the face of errors.
interface BackoffInfo {
  count: number,      // Number of consecutive backoffs.
  nextDelay: number,  // Current delay, in milliseconds.
  minDelay: number,   // Minimum delay, in milliseconds.
  maxDelay: number,   // Maximum delay, in milliseconds.
};

// State stored for each page in the pool.
interface ManagedPageInfo {
  lastCheckedOutAt: number,
  lastCheckedInAt: number,
  lastTaskDuration: number,
  lastError: Error | null,
  lastErrorUrl: string | null,
  taskPriority: PoolPriority,
  taskUrl: string | null,
  tasksCompleted: number,
  backoffs: {
    temporary: BackoffInfo,
    rateLimited: BackoffInfo,
  },
};

// Stated stored for each queued withPage() request.
interface QueuedRequest {
  priority: PoolPriority,
  url: string,
  callback: (page : puppeteer.Page) => void;
}

function delay(milliseconds : number) : Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, milliseconds); } );
}

async function backOff(state : BackoffInfo) : Promise<void> {
  state.count += 1;
  await delay(state.nextDelay);
  state.nextDelay = Math.min(state.maxDelay, state.nextDelay * 2);
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

  // Implements PagePool#withPage().
  async withPage<T>(priority : PoolPriority, url : string,
                    f : PageFunction<T>) : Promise<T> {
    if (this.shuttingDown_)
      throw new Error("ResourceManager shut down");

    const page = await this.checkoutPage(priority, url);
    const pageInfo = this.pageInfo_.get(page);
    pageInfo.backoffs.rateLimited.count = 0;
    pageInfo.backoffs.rateLimited.nextDelay =
        pageInfo.backoffs.rateLimited.minDelay;
    pageInfo.backoffs.temporary.count = 0;
    pageInfo.backoffs.temporary.nextDelay =
        pageInfo.backoffs.temporary.minDelay;

    const startedAt = Date.now();
    try {
      while (true) {
        try {
          const response = await page.goto(url);
          return await f(page, response);
        } catch (e) {
          pageInfo.lastError = e;
          pageInfo.lastErrorUrl = pageInfo.taskUrl;

          // For now, we back off and retry indefinitely on special error types.
          //
          // TODO(pwnall): After a limit is exceeded, bail and try checking
          // out a different Chrome tab from the pool. Also consider closing
          // the erroring tab and replacing it with a different tab from the
          // same browser.

          if (isTemporaryError(e)) {
            await backOff(pageInfo.backoffs.temporary);
            continue;
          }

          if (isRateLimitedError(e)) {
            await backOff(pageInfo.backoffs.rateLimited);
            continue;
          }

          throw e;
        }
      }
    } finally {
      const endedAt = Date.now();
      pageInfo.lastTaskDuration = endedAt - startedAt;
      this.checkinPage(page);
    }
  }

  // Shuts down all resources connected to this pool.
  //
  // All pending tasks are de-scheduled. All launched browsers are terminated.
  // All connections to remote browsers are closed.
  async shutdown() : Promise<void> {
    if (this.shuttingDown_)
      throw new Error("ResourceManager already shut down");

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
    if (this.shuttingDown_)
      throw new Error("ResourceManager shut down");

    const browser = await puppeteer.launch({
      headless: false,
      args: ['--disable-notifications'],
    });

    await this.addBrowser(browser, maxPages);
  }

  // Connects to a remote browser and adds it to the pool.
  connectBrowser(wsUrl : string, maxPages : number = 1) : Promise<void> {
    if (this.shuttingDown_)
      throw new Error("ResourceManager shut down");

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

      puppeteer.connect({ browserWSEndpoint: wsUrl }).then((browser) => {
        connected = true;
        if (timedOut)
          return;

        clearTimeout(timeoutHandler);
        resolve(this.addBrowser(browser, maxPages));
      }).catch(reject);
    });
  }

  // Implements PagePool#pageCount().
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
  pageInfo() : Array<{ [key: string]: any }> {
    if (this.shuttingDown_)
      throw new Error("PagePool shut down");

    const result : Array<{ pageWsUrl: string, [key: string]: any }> = [];
    const now = Date.now();
    for (let [ page, pageInfo ] of this.pageInfo_) {
      let lastErrorMessage : string | null = null;
      let lastErrorLine : string | null = null;
      if (pageInfo.lastError !== null) {
        const splitTrace = pageInfo.lastError.stack.split('\n', 3);
        lastErrorMessage = splitTrace[0];
        lastErrorLine = splitTrace[1] && splitTrace[1].trim();
      }

      result.push({
        // TODO(pwnall): Try to get the URL exposed in the API.
        //     Path: Page._client -> Session._connection -> Connection.url()
        pageWsUrl: (page as any)._client._connection.url(),

        tasksCompleted: pageInfo.tasksCompleted,
        lastCheckedInAgo: (now - pageInfo.lastCheckedInAt) / 1000.0,
        lastCheckedOutAgo: (now - pageInfo.lastCheckedOutAt) / 1000.0,
        lastDuration: pageInfo.lastTaskDuration / 1000.0,
        lastErrorMessage: lastErrorMessage,
        lastErrorLine: lastErrorLine,
        lastErrorUrl: pageInfo.lastErrorUrl,
        taskPriority: PoolPriority[pageInfo.taskPriority],
        taskUrl: pageInfo.taskUrl,
        taskRateLimitedErrors: pageInfo.backoffs.rateLimited.count,
        taskRateLimitedDelay: pageInfo.backoffs.rateLimited.nextDelay / 1000.0,
        taskTemporaryErrors: pageInfo.backoffs.temporary.count,
        taskTemporaryDelay: pageInfo.backoffs.temporary.nextDelay / 1000.0,
      });
    }
    result.sort((a, b) => a.pageWsUrl.localeCompare(b.pageWsUrl));
    return result;
  }

  // Withdraws a Chrome tab from the pool of available resources.
  //
  // The caller must use checkinPage() to return the tab to the pool.
  private checkoutPage(priority : PoolPriority, url : string)
      : Promise<puppeteer.Page> {
    if (this.shuttingDown_)
      return Promise.resolve(null);

    const now = Date.now();
    if (this.freePages_.length > 0) {
      const page = this.freePages_.pop();
      const pageInfo = this.pageInfo_.get(page);
      pageInfo.lastCheckedOutAt = now;
      pageInfo.taskPriority = priority;
      pageInfo.taskUrl = url;
      return Promise.resolve(page);
    }

    return new Promise((resolve) => {
      this.queues_[priority].push({
        callback: resolve,
        priority: priority,
        url: url,
      });
    });
  }

  // Returns a Chrome tab to the pool of available resources.
  private checkinPage(page : puppeteer.Page) : void {
    const now = Date.now();
    const pageInfo = this.pageInfo_.get(page);
    pageInfo.lastCheckedInAt = now;
    pageInfo.taskPriority = PoolPriority.Invalid;
    pageInfo.taskUrl = null;
    pageInfo.tasksCompleted += 1;

    for (let i = 0; i < this.queues_.length; ++i) {
      const queue = this.queues_[i];

      if (queue.length > 0) {
        const queueItem = queue.pop();
        pageInfo.lastCheckedOutAt = now;
        pageInfo.taskPriority = queueItem.priority;
        pageInfo.taskUrl = queueItem.url;

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

  // Adds a Chrome browser instance's tabs to the pool of available resources.
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
        lastCheckedInAt: 0,  // Will be overwritten by checkinPage.
        lastTaskDuration: 0,
        lastError: null,
        lastErrorUrl: null,
        taskPriority: PoolPriority.Invalid,
        taskUrl: null,  // Will be overwritten by checkoutPage.
        tasksCompleted: -1,  // Will be incremented by checkinPage.
        backoffs: {
          temporary: {
            count: 0,  // Will be overwritten by checkoutPage.
            nextDelay: 0,  // Will be overwritten by checkoutPage.
            minDelay: 30 * 1000,  //  30 seconds
            maxDelay: 60 * 60 * 1000,  // 1 hour
          },
          rateLimited: {
            count: 0,  // Will be overwritten by checkoutPage.
            nextDelay: 0,  // Will be overwritten by checkoutPage.
            minDelay: 10 * 60 * 1000,  // 10 minutes
            maxDelay: 5 * 60 * 1000,  // 5 minutes
          },
        },
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
