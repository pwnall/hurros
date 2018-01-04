import PagePool, { PageFunction } from './page_pool';
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

  withPage<T>(url : string, f : PageFunction<T>) : Promise<T> {
    return this.resourceManager_.withPage(this.priority_, url, f);
  }

  pageCount() : number {
    return this.resourceManager_.pageCount();
  }

  // The priority of all withPage() requests proxied to the ResourceManager.
  private priority_ : PoolPriority;
  // The ResourceManager receiving all the requests.
  private resourceManager_ : ResourceManager;
}
