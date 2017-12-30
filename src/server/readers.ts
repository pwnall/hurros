import * as KoaRouter from 'koa-router';

import { readProfile } from '../db/profile';
import { readProfileMatchMetadata } from '../db/match_profile';
import { readMatch } from '../db/match';
import fetchProfile from '../jobs/fetch_profile';
import readProfileMatches from '../jobs/read_profile_matches';
import { pagePool } from './app';

const readers = {
  readProfileMatches: async (ctx : KoaRouter.IRouterContext,
                             next : () => Promise<any>) => {
    await next();

    const playerId = ctx.params.id as string;
    const profile = await readProfile(playerId);
    if (profile === null)
      return;

    const matches = await readProfileMatches(profile);
    ctx.response.body = matches;
  },
  readProfileHistory: async (ctx : KoaRouter.IRouterContext,
                             next : () => Promise<any>) => {
    await next();

    const playerId = ctx.params.id as string;
    const profile = await readProfile(playerId);
    if (profile === null)
      return;

    const matchesMetadata = await readProfileMatchMetadata(profile.playerId);
    ctx.response.body = matchesMetadata;
  },
  readProfile: async (ctx : KoaRouter.IRouterContext,
                      next : () => Promise<any>) => {
    await next();

    const playerId = ctx.params.id as string;
    const profile = await readProfile(playerId);
    if (profile !== null)
      ctx.response.body = profile;
  },
  readMatch: async (ctx : KoaRouter.IRouterContext,
                    next : () => Promise<any>) => {
    await next();

    const matchId = ctx.params.id as string;
    const match = await readMatch(matchId);
    if (match !== null)
      ctx.response.body = match;
  },
  fetchProfile: async (ctx : KoaRouter.IRouterContext,
                      next : () => Promise<any>) => {
    await next();

    const playerId = ctx.params.id as string;
    const profile = await fetchProfile(playerId, pagePool);
    if (profile !== null)
      ctx.response.body = profile;
  },
};

export default readers;