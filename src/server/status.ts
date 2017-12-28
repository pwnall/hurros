import * as v8 from 'v8';

import * as Koa from 'koa';

import { pagePool } from './app';

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
      pageCount: pagePool.pageCount(),
      urls: pagePool.pageWsUrls(),
    };
  },
};

export default status;