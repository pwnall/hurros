import * as puppeteer from 'puppeteer';

// Interface to a resource manager for Chrome tabs connected via Puppeteer.
export default interface PagePool {
  // Checks out a Chrome tab from the pool for the given asynchronous function.
  //
  // When the function returns or throws, the tab is checked back into the pool.
  // The function's return / throw value is passed to the caller.
  withPage<T>(f : (page: puppeteer.Page) => Promise<T>) : Promise<T>;

  // Number of pages available in the pool.
  //
  // This should be used for estimating the maximum parallelism of a task. Due
  // to concurrent demands on a pool, there is no guarantee that it would be
  // possible to check out the given number of pages.
  pageCount() : number;
}
