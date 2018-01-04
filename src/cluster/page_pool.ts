import * as puppeteer from 'puppeteer';

// Interface to a resource manager for Chrome tabs connected via Puppeteer.
export default interface PagePool {
  // Checks out a Chrome tab from the pool for the given task function.
  //
  // Navigates the tab to the given URL. If the navigation succeeds, the
  // function is invoked. The function should be idempotent, as it may be
  // invoked multiple times (potentially with different puppeteer.Page values),
  // in case timeouts or other exceptions occur.
  //
  // When the function returns or throws, the tab is checked back into the pool.
  // The function's return / throw value is passed to the caller.
  withPage<T>(url : string, f : PageFunction<T>) : Promise<T>;

  // Number of pages available in the pool.
  //
  // This should be used for estimating the maximum parallelism of a task. Due
  // to concurrent demands on a pool, there is no guarantee that it would be
  // possible to check out the given number of pages.
  pageCount() : number;
}

// Interface for a task function called by PagePool#withPage.
//
// The task function receives a puppeteer.Page navigated to the desired URL, and
// the puppeteer.Response produced by navigating to that page.
export interface PageFunction<T> {
  (page: puppeteer.Page, response : puppeteer.Response): Promise<T>;
}