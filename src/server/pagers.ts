import * as KoaRouter from 'koa-router';
import { readMatchesPaged } from '../db/match';
import { readProfilesPaged } from '../db/profile';

const pagers = {
  pagedProfiles: async (ctx : KoaRouter.IRouterContext,
                        next : () => Promise<any>) => {
    await next();

    const pageStart = (ctx.params.start as string) || '';
    const pageSize = (ctx.params.page_size as number) || 1000;
    const pagedResult = await readProfilesPaged(pageStart, pageSize);

    ctx.response.body = {
      data: pagedResult.data,
      next: pagedResult.nextPageStart,
    };
  },
  pagedMatches: async (ctx : KoaRouter.IRouterContext,
                       next : () => Promise<any>) => {
    await next();

    const pageStart = (ctx.params.start as string) || '';
    const pageSize = (ctx.params.page_size as number) || 100;
    const pagedResult = await readMatchesPaged(pageStart, pageSize);

    ctx.response.body = {
      data: pagedResult.data,
      next: pagedResult.nextPageStart,
    };
  },
};

export default pagers;