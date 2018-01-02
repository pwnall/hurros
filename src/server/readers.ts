import * as KoaRouter from 'koa-router';

import { readProfile } from '../db/profile';
import { readMatch } from '../db/match';
import { readProfileMatchMetadata } from '../db/match_profile';
import fetchMatch from '../jobs/fetch_match';
import fetchProfile from '../jobs/fetch_profile';
import readProfileMatches from '../jobs/read_profile_matches';
import { pagePool } from './app';
import populateMatchHistories from '../jobs/populate_match_histories';
import populateProfileHistory from '../jobs/populate_profile_history';
import readMatchHistories from '../jobs/read_match_histories';

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
  readMatchHistories: async (ctx : KoaRouter.IRouterContext,
                             next : () => Promise<any>) => {
    await next();

    const matchId = ctx.params.id as string;
    const match = await readMatch(matchId);
    if (match === null)
      return;

    const matchHistories = await readMatchHistories(match);
    ctx.response.body = {
      match: match,
      histories: matchHistories,
    };
  },
  fetchProfile: async (ctx : KoaRouter.IRouterContext,
                      next : () => Promise<any>) => {
    await next();

    const playerId = ctx.params.id as string;
    const profile = await fetchProfile(playerId, pagePool);
    ctx.response.body = profile;
  },
  fetchProfileHistory: async (ctx : KoaRouter.IRouterContext,
                              next : () => Promise<any>) => {
    await next();

    const playerId = ctx.params.id as string;
    const queueName = ctx.params.queue_name as string;
    const profile = await fetchProfile(playerId, pagePool);

    await populateProfileHistory(profile, queueName, pagePool);

    const matchesMetadata = await readProfileMatchMetadata(profile.playerId);
    ctx.response.body = matchesMetadata;
  },
  fetchMatch: async (ctx : KoaRouter.IRouterContext,
                     next : () => Promise<any>) => {
    await next();

    const matchId = ctx.params.id as string;
    const match = await fetchMatch(matchId, pagePool);

    ctx.response.body = match;
  },
  fetchMatchHistories: async (ctx : KoaRouter.IRouterContext,
                              next : () => Promise<any>) => {
    await next();

    const matchId = ctx.params.id as string;
    const match = await fetchMatch(matchId, pagePool);

    await populateMatchHistories(match, pagePool);
    const matchHistories = await readMatchHistories(match);
    ctx.response.body = {
      match: match,
      histories: matchHistories,
    };
  },
};

export default readers;