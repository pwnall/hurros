import * as KoaRouter from 'koa-router';
import { readProfilesPaged } from '../db/profile';

const pagers = {
  pagedProfiles: async (ctx : KoaRouter.IRouterContext,
                        next : () => Promise<any>) => {
    await next();

    const pageStart = (ctx.params.start as string) || '';
    const pageSize = 1000;
    const pagedResult = await readProfilesPaged(pageStart, pageSize);

    ctx.response.body = {
      data: pagedResult.data,
      next: pagedResult.nextPageStart,
    };
  },
};

export default pagers;