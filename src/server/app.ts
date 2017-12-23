import * as v8 from 'v8';

import * as Koa from 'koa';
import * as koaCors from '@koa/cors';
import * as koaJson from 'koa-json';
import * as KoaRouter from 'koa-router';

import { readProfile } from '../db/profile';
import readProfileMatches from '../jobs/read_profile_matches';
import { readProfileMatchMetadata } from '../db/match_profile';
import PagePool from '../cluster/page_pool';
import { readMatch } from '../db/match';

export const pagePool = new PagePool();

const router = new KoaRouter();
router.get('/profiles/:id/matches', async (ctx, next) => {
  await next();

  const playerId = ctx.params.id as string;
  const profile = await readProfile(playerId);
  if (profile === null)
    return;

  const matches = await readProfileMatches(profile);
  ctx.response.body = matches;
});
router.get('/profiles/:id/history', async (ctx, next) => {
  await next();

  const playerId = ctx.params.id as string;
  const profile = await readProfile(playerId);
  if (profile === null)
    return;

  const matchesMetadata = await readProfileMatchMetadata(profile.playerId);
  ctx.response.body = matchesMetadata;
});
router.get('/profiles/:id', async (ctx, next) => {
  await next();

  const playerId = ctx.params.id as string;
  const profile = await readProfile(playerId);
  if (profile !== null)
    ctx.response.body = profile;
});
router.get('/matches/:id', async (ctx, next) => {
  await next();

  const matchId = ctx.params.id as string;
  const match = await readMatch(matchId);
  if (match !== null)
    ctx.response.body = match;
});
router.get('/status/pool', async (ctx, next) => {
  await next();

  ctx.response.body = {
    pageCount: pagePool.pageCount(),
    urls: pagePool.pageWsUrls(),
  };
});
router.get('/status/memory', async (ctx, next) => {
  await next();

  ctx.response.body = {
    process: process.memoryUsage(),
    heap: v8.getHeapStatistics(),
  };
})
router.get('/status', async (ctx, next) => {
  await next();

  ctx.response.body = 'OK';
});

export const app = new Koa();
app.use(koaCors());
app.use(koaJson({ pretty: false, param: 'pretty_json' }));
app.use(router.routes()).use(router.allowedMethods());
