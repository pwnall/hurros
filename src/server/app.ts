import * as Koa from 'koa';
import * as koaCors from '@koa/cors';
import * as koaJson from 'koa-json';
import * as KoaRouter from 'koa-router';

import PagePool from '../cluster/page_pool';
import { PrioritizedPagePool, PoolPriority } from '../cluster/pool_priority';
import ResourceManager from '../cluster/resource_manager';
import pagers from './pagers';
import readers from './readers';
import status from './status';

// The resource manager exposed by the /status/pool API.
export const resourceManager = new ResourceManager();

// Used to fulfill all the requests coming from the HTTP API.
export const apiPagePool : PagePool =
    new PrioritizedPagePool(resourceManager, PoolPriority.Interactive);

const router = new KoaRouter();

router.get('/profiles/:id/history/:queue_name', readers.readProfileHistory);
router.get('/profiles/:id/history', readers.readProfileHistory);
router.get('/profiles/:id/matches/:queue_name', readers.readProfileMatches);
router.get('/profiles/:id/matches', readers.readProfileMatches);
router.get('/profiles/:id', readers.readProfile);
router.get('/matches/:id/histories', readers.readMatchHistories);
router.get('/matches/:id', readers.readMatch);

router.get('/fetch/profiles/:id', readers.fetchProfile);
router.get('/fetch/profiles/:id/history/:queue_name',
           readers.fetchProfileHistory);
router.get('/fetch/profiles/:id/matches/:queue_name',
           readers.fetchProfileMatches);
router.get('/fetch/matches/:id/histories', readers.fetchMatchHistories);
router.get('/fetch/matches/:id', readers.fetchMatch);

router.get('/paged/profiles/:start', pagers.pagedProfiles);
router.get('/paged/profiles/', pagers.pagedProfiles);
router.get('/paged/matches/:start', pagers.pagedMatches);
router.get('/paged/matches/', pagers.pagedMatches);

router.get('/status/pool', status.pool);
router.get('/status/memory', status.memory);
router.get('/status', status.index);

export const app = new Koa();
app.use(koaCors());
app.use(koaJson({ pretty: false, param: 'pretty_json' }));
app.use(router.routes()).use(router.allowedMethods());
