import * as KoaRouter from 'koa-router';

import { apiPagePool } from './app';
import { readProfile } from '../db/profile';
import { readMatch } from '../db/match';
import { readProfileMatchMetadata } from '../db/match_profile';
import fetchMatch from '../jobs/fetch_match';
import fetchProfile from '../jobs/fetch_profile';
import populateMatchHistories from '../jobs/populate_match_histories';
import populateProfileHistory from '../jobs/populate_profile_history';
import populateProfileMatches from '../jobs/populate_profile_matches';
import readMatchHistories from '../jobs/read_match_histories';
import readProfileMatches from '../jobs/read_profile_matches';

const readers = {
  readProfile: async (ctx : KoaRouter.IRouterContext,
                      next : () => Promise<any>) => {
    await next();

    const playerId = ctx.params.id as string;
    const profile = await readProfile(playerId);
    if (profile !== null)
      ctx.response.body = profile;
  },
  readProfileHistory: async (ctx : KoaRouter.IRouterContext,
                             next : () => Promise<any>) => {
    await next();

    const playerId = ctx.params.id as string;
    const queueName = (ctx.params.queue_name as string) || null;
    const profile = await readProfile(playerId);
    if (profile === null)
      return;

    const matchesMetadata = await readProfileMatchMetadata(profile.playerId,
                                                           queueName);
    ctx.response.body = matchesMetadata;
  },
  readProfileMatches: async (ctx : KoaRouter.IRouterContext,
                             next : () => Promise<any>) => {
    await next();

    const playerId = ctx.params.id as string;
    const queueName = (ctx.params.queue_name as string) || null;
    const profile = await readProfile(playerId);
    if (profile === null)
      return;

    const matches = await readProfileMatches(profile, queueName);
    ctx.response.body = matches;
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
    const profile = await fetchProfile(playerId, apiPagePool);
    ctx.response.body = profile;
  },
  fetchProfileHistory: async (ctx : KoaRouter.IRouterContext,
                              next : () => Promise<any>) => {
    await next();

    const playerId = ctx.params.id as string;
    const queueName = ctx.params.queue_name as string;
    const profile = await fetchProfile(playerId, apiPagePool);

    await populateProfileHistory(profile, queueName, apiPagePool);

    const matchesMetadata = await readProfileMatchMetadata(profile.playerId,
                                                           queueName);
    ctx.response.body = matchesMetadata;
  },
  fetchProfileMatches: async (ctx : KoaRouter.IRouterContext,
                              next : () => Promise<any>) => {
    await next();

    const playerId = ctx.params.id as string;
    const queueName = ctx.params.queue_name as string;
    const profile = await fetchProfile(playerId, apiPagePool);

    await populateProfileHistory(profile, queueName, apiPagePool);
    await populateProfileMatches(profile, queueName, apiPagePool);

    const matches = await readProfileMatches(profile, queueName);
    ctx.response.body = matches;
  },
  fetchMatch: async (ctx : KoaRouter.IRouterContext,
                     next : () => Promise<any>) => {
    await next();

    const matchId = ctx.params.id as string;
    const match = await fetchMatch(matchId, apiPagePool);

    ctx.response.body = match;
  },
  fetchMatchHistories: async (ctx : KoaRouter.IRouterContext,
                              next : () => Promise<any>) => {
    await next();

    const matchId = ctx.params.id as string;
    const match = await fetchMatch(matchId, apiPagePool);

    await populateMatchHistories(match, apiPagePool);
    const matchHistories = await readMatchHistories(match);
    ctx.response.body = {
      match: match,
      histories: matchHistories,
    };
  },
};

export default readers;