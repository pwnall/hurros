import * as puppeteer from 'puppeteer';

import PagePool from './page_pool';
import ResourceManager from './resource_manager';

export enum PoolPriority {
  Interactive = 0,
  High = 1,
  Medium = 2,
  Low = 3,
  Background = 4,

  // The ResourceManager implementation assumes Invalid is the enum's max value.
  Invalid = 5,
};

// Proxies PagePool requests to a ResourceManager.
export class PrioritizedPagePool implements PagePool {
  constructor(resourceManager : ResourceManager, priority : PoolPriority) {
    this.resourceManager_ = resourceManager;
    this.priority_ = priority;
  }

  withPage<T>(f : (page: puppeteer.Page) => Promise<T>) : Promise<T> {
    // TODO(pwnall):  Propagate URL-based task reservation.
    return this.resourceManager_.withPage(this.priority_, '', f);
  }

  pageCount() : number {
    return this.resourceManager_.pageCount();
  }

  private priority_ : PoolPriority;
  private resourceManager_ : ResourceManager;
}
