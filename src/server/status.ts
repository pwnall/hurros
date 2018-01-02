import * as v8 from 'v8';

import * as Koa from 'koa';

import { resourceManager } from './app';

const status = {
  index: async (ctx : Koa.Context, next : () => Promise<any>) => {
    await next();
    ctx.response.body = 'OK';
  },

  memory: async (ctx : Koa.Context, next : () => Promise<any>) => {
    await next();

    ctx.response.body = {
      process: process.memoryUsage(),
      heap: v8.getHeapStatistics(),
    };
  },

  pool: async (ctx : Koa.Context, next : () => Promise<any>) => {
    await next();

    ctx.response.body = {
      pageCount: resourceManager.pageCount(),
      freePageCount: resourceManager.freePageCount(),
      queueSizes: resourceManager.queueSizes(),
      pageInfo: resourceManager.pageInfo(),
    };
  },
};

export default status;