import { module, test } from 'qunit';
import supertest, { Test, SuperTest } from 'supertest';
import { join, resolve } from 'path';
import { Server } from 'http';
import { dirSync, setGracefulCleanup, type DirResult } from 'tmp';
import { validate as uuidValidate } from 'uuid';
import {
  copySync,
  existsSync,
  ensureDirSync,
  readFileSync,
  readJSONSync,
  removeSync,
  writeJSONSync,
} from 'fs-extra';
import {
  cardSrc,
  compiledCard,
} from '@cardstack/runtime-common/etc/test-fixtures';
import {
  isSingleCardDocument,
  baseRealm,
  loadCard,
  Deferred,
  RealmPaths,
  Realm,
  RealmPermissions,
  fetchUserPermissions,
  baseCardRef,
  type LooseSingleCardDocument,
  type SingleCardDocument,
  type QueuePublisher,
  type QueueRunner,
  encodeWebSafeBase64,
} from '@cardstack/runtime-common';
import { stringify } from 'qs';
import { v4 as uuidv4 } from 'uuid';
import { Query } from '@cardstack/runtime-common/query';
import {
  setupCardLogs,
  setupBaseRealmServer,
  runTestRealmServer,
  setupDB,
  createRealm,
  realmServerTestMatrix,
  secretSeed,
  createVirtualNetwork,
  createVirtualNetworkAndLoader,
  matrixURL,
  closeServer,
  getFastbootState,
  matrixRegistrationSecret,
  seedPath,
  testRealmInfo,
  insertUser,
  insertPlan,
  fetchSubscriptionsByUserId,
  cleanWhiteSpace,
} from './helpers';
import '@cardstack/runtime-common/helpers/code-equality-assertion';
import eventSource from 'eventsource';
import { shimExternals } from '../lib/externals';
import { RealmServer } from '../server';
import type * as CardAPI from 'https://cardstack.com/base/card-api';
import stripScopedCSSGlimmerAttributes from '@cardstack/runtime-common/helpers/strip-scoped-css-glimmer-attributes';
import { MatrixClient } from '@cardstack/runtime-common/matrix-client';
import jwt from 'jsonwebtoken';
import { type CardCollectionDocument } from '@cardstack/runtime-common/card-document';
import { type PgAdapter } from '@cardstack/postgres';
import {
  addToCreditsLedger,
  insertSubscriptionCycle,
  insertSubscription,
} from '@cardstack/billing/billing-queries';
import {
  createJWT as createRealmServerJWT,
  RealmServerTokenClaim,
} from '../utils/jwt';
import { resetCatalogRealms } from '../handlers/handle-fetch-catalog-realms';
import Stripe from 'stripe';
import sinon from 'sinon';
import { getStripe } from '@cardstack/billing/stripe-webhook-handlers/stripe';

setGracefulCleanup();
const testRealmURL = new URL('http://127.0.0.1:4444/');
const testRealm2URL = new URL('http://127.0.0.1:4445/test/');
const testRealmHref = testRealmURL.href;
const testRealm2Href = testRealm2URL.href;
const distDir = resolve(join(__dirname, '..', '..', 'host', 'dist'));
console.log(`using host dist dir: ${distDir}`);

let createJWT = (
  realm: Realm,
  user: string,
  permissions: RealmPermissions['user'] = [],
) => {
  return realm.createJWT({ user, realm: realm.url, permissions }, '7d');
};

module('Realm Server', function (hooks) {
  async function expectEvent<T>({
    assert,
    expected,
    expectedNumberOfEvents,
    onEvents,
    callback,
  }: {
    assert: Assert;
    expected?: Record<string, any>[];
    expectedNumberOfEvents?: number;
    onEvents?: (events: Record<string, any>[]) => void;
    callback: () => Promise<T>;
  }): Promise<T> {
    let defer = new Deferred<Record<string, any>[]>();
    let events: Record<string, any>[] = [];
    let maybeNumEvents = expected?.length ?? expectedNumberOfEvents;
    if (maybeNumEvents == null) {
      throw new Error(
        `expectEvent() must specify either 'expected' or 'expectedNumberOfEvents'`,
      );
    }
    let numEvents = maybeNumEvents;
    let es = new eventSource(`${testRealmHref}_message`);
    es.addEventListener('index', (ev: MessageEvent) => {
      events.push(JSON.parse(ev.data));
      if (events.length >= numEvents) {
        defer.fulfill(events);
      }
    });
    es.onerror = (err: Event) => defer.reject(err);
    let timeout = setTimeout(() => {
      defer.reject(
        new Error(
          `expectEvent timed out, saw events ${JSON.stringify(events)}`,
        ),
      );
    }, 5000);
    await new Promise((resolve) => es.addEventListener('open', resolve));
    let result = await callback();
    let actualEvents = await defer.promise;
    if (expected) {
      assert.deepEqual(actualEvents, expected);
    }
    if (onEvents) {
      onEvents(actualEvents);
    }
    clearTimeout(timeout);
    es.close();
    return result;
  }

  let testRealm: Realm;
  let testRealmHttpServer: Server;
  let request: SuperTest<Test>;
  let dir: DirResult;
  let dbAdapter: PgAdapter;

  function setupPermissionedRealm(
    hooks: NestedHooks,
    permissions: RealmPermissions,
    fileSystem?: Record<string, string | LooseSingleCardDocument>,
  ) {
    setupDB(hooks, {
      beforeEach: async (_dbAdapter, publisher, runner) => {
        dbAdapter = _dbAdapter;
        dir = dirSync();
        let testRealmDir = join(dir.name, 'realm_server_1', 'test');
        ensureDirSync(testRealmDir);
        // If a fileSystem is provided, use it to populate the test realm, otherwise copy the default cards
        if (!fileSystem) {
          copySync(join(__dirname, 'cards'), testRealmDir);
        }
        let virtualNetwork = createVirtualNetwork();
        ({ testRealm, testRealmHttpServer } = await runTestRealmServer({
          virtualNetwork,
          testRealmDir,
          realmsRootPath: join(dir.name, 'realm_server_1'),
          realmURL: testRealmURL,
          permissions,
          dbAdapter: _dbAdapter,
          runner,
          publisher,
          matrixURL,
          fileSystem,
        }));

        request = supertest(testRealmHttpServer);
      },
    });
  }

  let { virtualNetwork, loader } = createVirtualNetworkAndLoader();

  setupCardLogs(
    hooks,
    async () => await loader.import(`${baseRealm.url}card-api`),
  );

  setupBaseRealmServer(hooks, virtualNetwork, matrixURL);

  hooks.beforeEach(async function () {
    dir = dirSync();
    copySync(join(__dirname, 'cards'), dir.name);
  });

  hooks.afterEach(async function () {
    await closeServer(testRealmHttpServer);
    resetCatalogRealms();
  });

  module('permissions requests', function (hooks) {
    setupPermissionedRealm(hooks, {
      mary: ['read', 'write', 'realm-owner'],
      bob: ['read', 'write'],
    });

    test('non-owner GET /_permissions', async function (assert) {
      let response = await request
        .get('/_permissions')
        .set('Accept', 'application/vnd.api+json')
        .set(
          'Authorization',
          `Bearer ${createJWT(testRealm, 'bob', ['read', 'write'])}`,
        );

      assert.strictEqual(response.status, 403, 'HTTP 403 status');
    });

    test('realm-owner GET /_permissions', async function (assert) {
      let response = await request
        .get('/_permissions')
        .set('Accept', 'application/vnd.api+json')
        .set(
          'Authorization',
          `Bearer ${createJWT(testRealm, 'mary', [
            'read',
            'write',
            'realm-owner',
          ])}`,
        );

      assert.strictEqual(response.status, 200, 'HTTP 200 status');
      let json = response.body;
      assert.deepEqual(
        json,
        {
          data: {
            type: 'permissions',
            id: testRealmHref,
            attributes: {
              permissions: {
                mary: ['read', 'write', 'realm-owner'],
                bob: ['read', 'write'],
              },
            },
          },
        },
        'permissions response is correct',
      );
    });

    test('non-owner PATCH /_permissions', async function (assert) {
      let response = await request
        .patch('/_permissions')
        .set('Accept', 'application/vnd.api+json')
        .set(
          'Authorization',
          `Bearer ${createJWT(testRealm, 'bob', ['read', 'write'])}`,
        )
        .send({
          data: {
            id: testRealmHref,
            type: 'permissions',
            attributes: {
              permissions: {
                mango: ['read'],
              },
            },
          },
        });

      assert.strictEqual(response.status, 403, 'HTTP 403 status');
      let permissions = await fetchUserPermissions(dbAdapter, testRealmURL);
      assert.deepEqual(
        permissions,
        {
          mary: ['read', 'write', 'realm-owner'],
          bob: ['read', 'write'],
        },
        'permissions did not change',
      );
    });

    test('realm-owner PATCH /_permissions', async function (assert) {
      let response = await request
        .patch('/_permissions')
        .set('Accept', 'application/vnd.api+json')
        .set(
          'Authorization',
          `Bearer ${createJWT(testRealm, 'mary', [
            'read',
            'write',
            'realm-owner',
          ])}`,
        )
        .send({
          data: {
            id: testRealmHref,
            type: 'permissions',
            attributes: {
              permissions: {
                mango: ['read'],
              },
            },
          },
        });

      assert.strictEqual(response.status, 200, 'HTTP 200 status');
      let json = response.body;
      assert.deepEqual(
        json,
        {
          data: {
            type: 'permissions',
            id: testRealmHref,
            attributes: {
              permissions: {
                mary: ['read', 'write', 'realm-owner'],
                bob: ['read', 'write'],
                mango: ['read'],
              },
            },
          },
        },
        'permissions response is correct',
      );
      let permissions = await fetchUserPermissions(dbAdapter, testRealmURL);
      assert.deepEqual(
        permissions,
        {
          mary: ['read', 'write', 'realm-owner'],
          bob: ['read', 'write'],
          mango: ['read'],
        },
        'permissions are correct',
      );
    });

    test('remove permissions from PATCH /_permissions using empty array', async function (assert) {
      let response = await request
        .patch('/_permissions')
        .set('Accept', 'application/vnd.api+json')
        .set(
          'Authorization',
          `Bearer ${createJWT(testRealm, 'mary', [
            'read',
            'write',
            'realm-owner',
          ])}`,
        )
        .send({
          data: {
            id: testRealmHref,
            type: 'permissions',
            attributes: {
              permissions: {
                bob: [],
              },
            },
          },
        });

      assert.strictEqual(response.status, 200, 'HTTP 200 status');
      let json = response.body;
      assert.deepEqual(
        json,
        {
          data: {
            type: 'permissions',
            id: testRealmHref,
            attributes: {
              permissions: {
                mary: ['read', 'write', 'realm-owner'],
              },
            },
          },
        },
        'permissions response is correct',
      );
      let permissions = await fetchUserPermissions(dbAdapter, testRealmURL);
      assert.deepEqual(
        permissions,
        {
          mary: ['read', 'write', 'realm-owner'],
        },
        'permissions are correct',
      );
    });

    test('remove permissions from PATCH /_permissions using null', async function (assert) {
      let response = await request
        .patch('/_permissions')
        .set('Accept', 'application/vnd.api+json')
        .set(
          'Authorization',
          `Bearer ${createJWT(testRealm, 'mary', [
            'read',
            'write',
            'realm-owner',
          ])}`,
        )
        .send({
          data: {
            id: testRealmHref,
            type: 'permissions',
            attributes: {
              permissions: {
                bob: null,
              },
            },
          },
        });

      assert.strictEqual(response.status, 200, 'HTTP 200 status');
      let json = response.body;
      assert.deepEqual(
        json,
        {
          data: {
            type: 'permissions',
            id: testRealmHref,
            attributes: {
              permissions: {
                mary: ['read', 'write', 'realm-owner'],
              },
            },
          },
        },
        'permissions response is correct',
      );
      let permissions = await fetchUserPermissions(dbAdapter, testRealmURL);
      assert.deepEqual(
        permissions,
        {
          mary: ['read', 'write', 'realm-owner'],
        },
        'permissions are correct',
      );
    });

    test('cannot remove realm-owner permissions from PATCH /_permissions', async function (assert) {
      let response = await request
        .patch('/_permissions')
        .set('Accept', 'application/vnd.api+json')
        .set(
          'Authorization',
          `Bearer ${createJWT(testRealm, 'mary', [
            'read',
            'write',
            'realm-owner',
          ])}`,
        )
        .send({
          data: {
            id: testRealmHref,
            type: 'permissions',
            attributes: {
              permissions: {
                mary: [],
              },
            },
          },
        });

      assert.strictEqual(response.status, 400, 'HTTP 400 status');
      let permissions = await fetchUserPermissions(dbAdapter, testRealmURL);
      assert.deepEqual(
        permissions,
        {
          mary: ['read', 'write', 'realm-owner'],
          bob: ['read', 'write'],
        },
        'permissions are correct',
      );
    });

    test('cannot add realm-owner permissions from PATCH /_permissions', async function (assert) {
      let response = await request
        .patch('/_permissions')
        .set('Accept', 'application/vnd.api+json')
        .set(
          'Authorization',
          `Bearer ${createJWT(testRealm, 'mary', [
            'read',
            'write',
            'realm-owner',
          ])}`,
        )
        .send({
          data: {
            id: testRealmHref,
            type: 'permissions',
            attributes: {
              permissions: {
                mango: ['realm-owner', 'write', 'read'],
              },
            },
          },
        });

      assert.strictEqual(response.status, 400, 'HTTP 400 status');
      let permissions = await fetchUserPermissions(dbAdapter, testRealmURL);
      assert.deepEqual(
        permissions,
        {
          mary: ['read', 'write', 'realm-owner'],
          bob: ['read', 'write'],
        },
        'permissions are correct',
      );
    });

    test('receive 400 error on invalid JSON API', async function (assert) {
      let response = await request
        .patch('/_permissions')
        .set('Accept', 'application/vnd.api+json')
        .set(
          'Authorization',
          `Bearer ${createJWT(testRealm, 'mary', [
            'read',
            'write',
            'realm-owner',
          ])}`,
        )
        .send({
          data: { nothing: null },
        });

      assert.strictEqual(response.status, 400, 'HTTP 400 status');
      let permissions = await fetchUserPermissions(dbAdapter, testRealmURL);
      assert.deepEqual(
        permissions,
        {
          mary: ['read', 'write', 'realm-owner'],
          bob: ['read', 'write'],
        },
        'permissions are correct',
      );
    });

    test('receive 400 error on invalid permissions shape', async function (assert) {
      let response = await request
        .patch('/_permissions')
        .set('Accept', 'application/vnd.api+json')
        .set(
          'Authorization',
          `Bearer ${createJWT(testRealm, 'mary', [
            'read',
            'write',
            'realm-owner',
          ])}`,
        )
        .send({
          data: {
            id: testRealmHref,
            type: 'permissions',
            attributes: {
              permissions: {
                larry: { read: true },
              },
            },
          },
        });

      assert.strictEqual(response.status, 400, 'HTTP 400 status');
      let permissions = await fetchUserPermissions(dbAdapter, testRealmURL);
      assert.deepEqual(
        permissions,
        {
          mary: ['read', 'write', 'realm-owner'],
          bob: ['read', 'write'],
        },
        'permissions are correct',
      );
    });
  });

  module('card GET request', function (_hooks) {
    module('public readable realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        '*': ['read'],
      });

      test('serves the request', async function (assert) {
        let response = await request
          .get('/person-1')
          .set('Accept', 'application/vnd.card+json');

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        let json = response.body;
        assert.ok(json.data.meta.lastModified, 'lastModified exists');
        delete json.data.meta.lastModified;
        delete json.data.meta.resourceCreatedAt;
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        assert.deepEqual(json, {
          data: {
            id: `${testRealmHref}person-1`,
            type: 'card',
            attributes: {
              title: 'Mango',
              firstName: 'Mango',
              description: null,
              thumbnailURL: null,
            },
            meta: {
              adoptsFrom: {
                module: `./person`,
                name: 'Person',
              },
              realmInfo: testRealmInfo,
              realmURL: testRealmURL.href,
            },
            links: {
              self: `${testRealmHref}person-1`,
            },
          },
        });
      });

      test('serves a card error request without last known good state', async function (assert) {
        let response = await request
          .get('/missing-link')
          .set('Accept', 'application/vnd.card+json');

        assert.strictEqual(response.status, 500, 'HTTP 500 status');
        let json = response.body;
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );

        let errorBody = json.errors[0];
        assert.ok(errorBody.meta.stack.includes('at CurrentRun.visitFile'));
        delete errorBody.meta.stack;
        assert.deepEqual(errorBody, {
          id: `${testRealmHref}missing-link`,
          status: 404,
          title: 'Not Found',
          message: `missing file ${testRealmHref}does-not-exist.json`,
          realm: testRealmHref,
          meta: {
            lastKnownGoodHtml: null,
            scopedCssUrls: [],
          },
        });
      });
    });

    // using public writable realm to make it easy for test setup for the error tests
    module('public writable realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        '*': ['read', 'write'],
      });

      test('serves a card error request with last known good state', async function (assert) {
        await request
          .patch('/hassan')
          .send({
            data: {
              type: 'card',
              relationships: {
                friend: {
                  links: {
                    self: './does-not-exist',
                  },
                },
              },
              meta: {
                adoptsFrom: {
                  module: './friend.gts',
                  name: 'Friend',
                },
              },
            },
          })
          .set('Accept', 'application/vnd.card+json');

        let response = await request
          .get('/hassan')
          .set('Accept', 'application/vnd.card+json');

        assert.strictEqual(response.status, 500, 'HTTP 500 status');
        let json = response.body;
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );

        let errorBody = json.errors[0];
        let lastKnownGoodHtml = cleanWhiteSpace(
          errorBody.meta.lastKnownGoodHtml,
        );

        assert.ok(errorBody.meta.stack.includes('at CurrentRun.visitFile'));
        assert.strictEqual(errorBody.status, 404);
        assert.strictEqual(errorBody.title, 'Not Found');
        assert.strictEqual(
          errorBody.message,
          `missing file ${testRealmHref}does-not-exist.json`,
        );
        assert.ok(lastKnownGoodHtml.includes('Hassan has a friend'));
        assert.ok(lastKnownGoodHtml.includes('Jade'));
        let scopedCssUrls = errorBody.meta.scopedCssUrls;
        assertScopedCssUrlsContain(
          assert,
          scopedCssUrls,
          cardDefModuleDependencies,
        );
      });
    });

    module('permissioned realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        john: ['read'],
      });

      test('401 with invalid JWT', async function (assert) {
        let response = await request
          .get('/person-1')
          .set('Accept', 'application/vnd.card+json')
          .set('Authorization', `Bearer invalid-token`);

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          undefined,
          'realm is not public readable',
        );
      });

      test('401 without a JWT', async function (assert) {
        let response = await request
          .get('/person-1')
          .set('Accept', 'application/vnd.card+json'); // no Authorization header

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          undefined,
          'realm is not public readable',
        );
      });

      test('403 without permission', async function (assert) {
        let response = await request
          .get('/person-1')
          .set('Accept', 'application/vnd.card+json')
          .set('Authorization', `Bearer ${createJWT(testRealm, 'not-john')}`);

        assert.strictEqual(response.status, 403, 'HTTP 403 status');
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          undefined,
          'realm is not public readable',
        );
      });

      test('200 with permission', async function (assert) {
        let response = await request
          .get('/person-1')
          .set('Accept', 'application/vnd.card+json')
          .set(
            'Authorization',
            `Bearer ${createJWT(testRealm, 'john', ['read'])}`,
          );

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          undefined,
          'realm is not public readable',
        );
      });
    });
  });

  module('card POST request', function (_hooks) {
    module('public writable realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        '*': ['read', 'write'],
      });

      test('serves the request', async function (assert) {
        assert.expect(9);
        let id: string | undefined;
        let response = await expectEvent({
          assert,
          expectedNumberOfEvents: 2,
          onEvents: ([_, event]) => {
            if (event.type === 'incremental') {
              id = event.invalidations[0].split('/').pop()!;
              assert.true(uuidValidate(id!), 'card identifier is a UUID');
              assert.strictEqual(
                event.invalidations[0],
                `${testRealmURL}CardDef/${id}`,
              );
            } else {
              assert.ok(
                false,
                `expect to receive 'incremental' event, but saw ${JSON.stringify(
                  event,
                )} `,
              );
            }
          },
          callback: async () => {
            return await request
              .post('/')
              .send({
                data: {
                  type: 'card',
                  attributes: {},
                  meta: {
                    adoptsFrom: {
                      module: 'https://cardstack.com/base/card-api',
                      name: 'CardDef',
                    },
                  },
                },
              })
              .set('Accept', 'application/vnd.card+json');
          },
        });
        if (!id) {
          assert.ok(false, 'new card identifier was undefined');
        }
        assert.strictEqual(response.status, 201, 'HTTP 201 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        let json = response.body;

        if (isSingleCardDocument(json)) {
          assert.strictEqual(
            json.data.id,
            `${testRealmHref}CardDef/${id}`,
            'the id is correct',
          );
          assert.ok(json.data.meta.lastModified, 'lastModified is populated');
          let cardFile = join(
            dir.name,
            'realm_server_1',
            'test',
            'CardDef',
            `${id}.json`,
          );
          assert.ok(existsSync(cardFile), 'card json exists');
          let card = readJSONSync(cardFile);
          assert.deepEqual(
            card,
            {
              data: {
                attributes: {
                  title: null,
                  description: null,
                  thumbnailURL: null,
                },
                type: 'card',
                meta: {
                  adoptsFrom: {
                    module: 'https://cardstack.com/base/card-api',
                    name: 'CardDef',
                  },
                },
              },
            },
            'file contents are correct',
          );
        } else {
          assert.ok(false, 'response body is not a card document');
        }
      });
    });

    module('permissioned realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        john: ['read', 'write'],
      });

      test('401 with invalid JWT', async function (assert) {
        let response = await request
          .post('/')
          .send({})
          .set('Accept', 'application/vnd.card+json')
          .set('Authorization', `Bearer invalid-token`);

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('401 without a JWT', async function (assert) {
        let response = await request
          .post('/')
          .send({})
          .set('Accept', 'application/vnd.card+json'); // no Authorization header

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('401 permissions have been updated', async function (assert) {
        let response = await request
          .post('/')
          .send({})
          .set('Accept', 'application/vnd.card+json')
          .set(
            'Authorization',
            `Bearer ${createJWT(testRealm, 'john', ['read'])}`,
          );

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('403 without permission', async function (assert) {
        let response = await request
          .post('/')
          .send({})
          .set('Accept', 'application/vnd.card+json')
          .set('Authorization', `Bearer ${createJWT(testRealm, 'not-john')}`);

        assert.strictEqual(response.status, 403, 'HTTP 403 status');
      });

      test('201 with permission', async function (assert) {
        let response = await request
          .post('/')
          .send({
            data: {
              type: 'card',
              attributes: {},
              meta: {
                adoptsFrom: {
                  module: 'https://cardstack.com/base/card-api',
                  name: 'CardDef',
                },
              },
            },
          })
          .set('Accept', 'application/vnd.card+json')
          .set(
            'Authorization',
            `Bearer ${createJWT(testRealm, 'john', ['read', 'write'])}`,
          );

        assert.strictEqual(response.status, 201, 'HTTP 201 status');
      });
    });
  });

  module('card PATCH request', function (_hooks) {
    module('public writable realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        '*': ['read', 'write'],
      });

      test('serves the request', async function (assert) {
        let entry = 'person-1.json';
        let expected = [
          {
            type: 'incremental-index-initiation',
            realmURL: testRealmURL.href,
            updatedFile: `${testRealmURL}person-1.json`,
          },
          {
            type: 'incremental',
            invalidations: [`${testRealmURL}person-1`],
            realmURL: testRealmURL.href,
            clientRequestId: null,
          },
        ];
        let response = await expectEvent({
          assert,
          expected,
          callback: async () => {
            return await request
              .patch('/person-1')
              .send({
                data: {
                  type: 'card',
                  attributes: {
                    firstName: 'Van Gogh',
                  },
                  meta: {
                    adoptsFrom: {
                      module: './person.gts',
                      name: 'Person',
                    },
                  },
                },
              })
              .set('Accept', 'application/vnd.card+json');
          },
        });

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );

        let json = response.body;
        assert.ok(json.data.meta.lastModified, 'lastModified exists');
        if (isSingleCardDocument(json)) {
          assert.strictEqual(
            json.data.attributes?.firstName,
            'Van Gogh',
            'the field data is correct',
          );
          assert.ok(json.data.meta.lastModified, 'lastModified is populated');
          delete json.data.meta.lastModified;
          delete json.data.meta.resourceCreatedAt;
          let cardFile = join(dir.name, 'realm_server_1', 'test', entry);
          assert.ok(existsSync(cardFile), 'card json exists');
          let card = readJSONSync(cardFile);
          assert.deepEqual(
            card,
            {
              data: {
                type: 'card',
                attributes: {
                  firstName: 'Van Gogh',
                  description: null,
                  thumbnailURL: null,
                },
                meta: {
                  adoptsFrom: {
                    module: `./person`,
                    name: 'Person',
                  },
                },
              },
            },
            'file contents are correct',
          );
        } else {
          assert.ok(false, 'response body is not a card document');
        }

        let query: Query = {
          filter: {
            on: {
              module: `${testRealmHref}person`,
              name: 'Person',
            },
            eq: {
              firstName: 'Van Gogh',
            },
          },
        };

        response = await request
          .get(`/_search?${stringify(query)}`)
          .set('Accept', 'application/vnd.card+json');

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        assert.strictEqual(response.body.data.length, 1, 'found one card');
      });
    });

    module('permissioned realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        john: ['read', 'write'],
      });

      test('401 with invalid JWT', async function (assert) {
        let response = await request
          .patch('/person-1')
          .send({})
          .set('Accept', 'application/vnd.card+json')
          .set('Authorization', `Bearer invalid-token`);

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('403 without permission', async function (assert) {
        let response = await request
          .patch('/person-1')
          .send({
            data: {
              type: 'card',
              attributes: {
                firstName: 'Van Gogh',
              },
              meta: {
                adoptsFrom: {
                  module: './person.gts',
                  name: 'Person',
                },
              },
            },
          })
          .set('Accept', 'application/vnd.card+json')
          .set('Authorization', `Bearer ${createJWT(testRealm, 'not-john')}`);

        assert.strictEqual(response.status, 403, 'HTTP 403 status');
      });

      test('200 with permission', async function (assert) {
        let response = await request
          .patch('/person-1')
          .send({
            data: {
              type: 'card',
              attributes: {
                firstName: 'Van Gogh',
              },
              meta: {
                adoptsFrom: {
                  module: './person.gts',
                  name: 'Person',
                },
              },
            },
          })
          .set('Accept', 'application/vnd.card+json')
          .set(
            'Authorization',
            `Bearer ${createJWT(testRealm, 'john', ['read', 'write'])}`,
          );

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
      });
    });
  });

  module('card DELETE request', function (_hooks) {
    module('public writable realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        '*': ['read', 'write'],
      });

      test('serves the request', async function (assert) {
        let entry = 'person-1.json';
        let expected = [
          {
            type: 'incremental-index-initiation',
            realmURL: testRealmURL.href,
            updatedFile: `${testRealmURL}person-1.json`,
          },
          {
            type: 'incremental',
            realmURL: testRealmURL.href,
            invalidations: [`${testRealmURL}person-1`],
          },
        ];
        let response = await expectEvent({
          assert,
          expected,
          callback: async () => {
            return await request
              .delete('/person-1')
              .set('Accept', 'application/vnd.card+json');
          },
        });

        assert.strictEqual(response.status, 204, 'HTTP 204 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        let cardFile = join(dir.name, entry);
        assert.false(existsSync(cardFile), 'card json does not exist');
      });

      test('serves a card DELETE request with .json extension in the url', async function (assert) {
        let entry = 'person-1.json';
        let expected = [
          {
            type: 'incremental-index-initiation',
            realmURL: testRealmURL.href,
            updatedFile: `${testRealmURL}person-1.json`,
          },
          {
            type: 'incremental',
            realmURL: testRealmURL.href,
            invalidations: [`${testRealmURL}person-1`],
          },
        ];

        let response = await expectEvent({
          assert,
          expected,
          callback: async () => {
            return await request
              .delete('/person-1.json')
              .set('Accept', 'application/vnd.card+json');
          },
        });

        assert.strictEqual(response.status, 204, 'HTTP 204 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        let cardFile = join(dir.name, entry);
        assert.false(existsSync(cardFile), 'card json does not exist');
      });
    });

    module('permissioned realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        john: ['read', 'write'],
      });

      test('401 with invalid JWT', async function (assert) {
        let response = await request
          .delete('/person-1')

          .set('Accept', 'application/vnd.card+json')
          .set('Authorization', `Bearer invalid-token`);

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('403 without permission', async function (assert) {
        let response = await request
          .delete('/person-1')
          .set('Accept', 'application/vnd.card+json')
          .set('Authorization', `Bearer ${createJWT(testRealm, 'not-john')}`);

        assert.strictEqual(response.status, 403, 'HTTP 403 status');
      });

      test('204 with permission', async function (assert) {
        let response = await request
          .delete('/person-1')
          .set('Accept', 'application/vnd.card+json')
          .set(
            'Authorization',
            `Bearer ${createJWT(testRealm, 'john', ['read', 'write'])}`,
          );

        assert.strictEqual(response.status, 204, 'HTTP 204 status');
      });
    });
  });

  module('card source GET request', function (_hooks) {
    module('public readable realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        '*': ['read'],
      });

      test('serves the request', async function (assert) {
        let response = await request
          .get('/person.gts')
          .set('Accept', 'application/vnd.card+source');

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        let result = response.text.trim();
        assert.strictEqual(result, cardSrc, 'the card source is correct');
        assert.ok(
          response.headers['last-modified'],
          'last-modified header exists',
        );
      });

      test('serves a card-source GET request that results in redirect', async function (assert) {
        let response = await request
          .get('/person')
          .set('Accept', 'application/vnd.card+source');

        assert.strictEqual(response.status, 302, 'HTTP 302 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        assert.strictEqual(response.headers['location'], '/person.gts');
      });

      test('serves a card instance GET request with card-source accept header that results in redirect', async function (assert) {
        let response = await request
          .get('/person-1')
          .set('Accept', 'application/vnd.card+source');

        assert.strictEqual(response.status, 302, 'HTTP 302 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        assert.strictEqual(response.headers['location'], '/person-1.json');
      });

      test('serves a card instance GET request with a .json extension and json accept header that results in redirect', async function (assert) {
        let response = await request
          .get('/person.json')
          .set('Accept', 'application/vnd.card+json');

        assert.strictEqual(response.status, 302, 'HTTP 302 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        assert.strictEqual(response.headers['location'], '/person');
      });

      test('serves a module GET request', async function (assert) {
        let response = await request.get('/person');

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm URL header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        let body = response.text.trim();
        let moduleAbsolutePath = resolve(join(__dirname, '..', 'person.gts'));

        // Remove platform-dependent id, from https://github.com/emberjs/babel-plugin-ember-template-compilation/blob/d67cca121cfb3bbf5327682b17ed3f2d5a5af528/__tests__/tests.ts#LL1430C1-L1431C1
        body = stripScopedCSSGlimmerAttributes(
          body.replace(/"id":\s"[^"]+"/, '"id": "<id>"'),
        );

        assert.codeEqual(
          body,
          compiledCard('"<id>"', moduleAbsolutePath),
          'module JS is correct',
        );
      });
    });

    module('permissioned realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        john: ['read'],
      });

      test('401 with invalid JWT', async function (assert) {
        let response = await request
          .get('/person.gts')
          .set('Accept', 'application/vnd.card+source')
          .set('Authorization', `Bearer invalid-token`);

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('401 without a JWT', async function (assert) {
        let response = await request
          .get('/person.gts')
          .set('Accept', 'application/vnd.card+source'); // no Authorization header

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('403 without permission', async function (assert) {
        let response = await request
          .get('/person.gts')
          .set('Accept', 'application/vnd.card+source')
          .set('Authorization', `Bearer ${createJWT(testRealm, 'not-john')}`);

        assert.strictEqual(response.status, 403, 'HTTP 403 status');
      });

      test('200 with permission', async function (assert) {
        let response = await request
          .get('/person.gts')
          .set('Accept', 'application/vnd.card+source')
          .set(
            'Authorization',
            `Bearer ${createJWT(testRealm, 'john', ['read'])}`,
          );

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
      });
    });
  });

  module('card-source DELETE request', function (_hooks) {
    module('public writable realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        '*': ['read', 'write'],
      });

      test('serves the request', async function (assert) {
        let entry = 'unused-card.gts';
        let expected = [
          {
            type: 'incremental-index-initiation',
            realmURL: testRealmURL.href,
            updatedFile: `${testRealmURL}unused-card.gts`,
          },
          {
            type: 'incremental',
            realmURL: testRealmURL.href,
            invalidations: [`${testRealmURL}unused-card.gts`],
          },
        ];
        let response = await expectEvent({
          assert,
          expected,
          callback: async () => {
            return await request
              .delete('/unused-card.gts')
              .set('Accept', 'application/vnd.card+source');
          },
        });

        assert.strictEqual(response.status, 204, 'HTTP 204 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        let cardFile = join(dir.name, entry);
        assert.false(existsSync(cardFile), 'card module does not exist');
      });

      test('serves a card-source DELETE request for a card instance', async function (assert) {
        let entry = 'person-1';
        let expected = [
          {
            type: 'incremental-index-initiation',
            realmURL: testRealmURL.href,
            updatedFile: `${testRealmURL}person-1.json`,
          },
          {
            type: 'incremental',
            realmURL: testRealmURL.href,
            invalidations: [`${testRealmURL}person-1`],
          },
        ];
        let response = await expectEvent({
          assert,
          expected,
          callback: async () => {
            return await request
              .delete('/person-1')
              .set('Accept', 'application/vnd.card+source');
          },
        });

        assert.strictEqual(response.status, 204, 'HTTP 204 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        let cardFile = join(dir.name, entry);
        assert.false(existsSync(cardFile), 'card instance does not exist');
      });
    });

    module('permissioned realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        john: ['read', 'write'],
      });

      test('401 with invalid JWT', async function (assert) {
        let response = await request
          .delete('/unused-card.gts')
          .set('Accept', 'application/vnd.card+source')
          .set('Authorization', `Bearer invalid-token`);

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('403 without permission', async function (assert) {
        let response = await request
          .delete('/unused-card.gts')
          .set('Accept', 'application/vnd.card+source')
          .set('Authorization', `Bearer ${createJWT(testRealm, 'not-john')}`);

        assert.strictEqual(response.status, 403, 'HTTP 403 status');
      });

      test('204 with permission', async function (assert) {
        let response = await request
          .delete('/unused-card.gts')
          .set('Accept', 'application/vnd.card+source')
          .set(
            'Authorization',
            `Bearer ${createJWT(testRealm, 'john', ['read', 'write'])}`,
          );

        assert.strictEqual(response.status, 204, 'HTTP 204 status');
      });
    });
  });

  module('card-source POST request', function (_hooks) {
    module('public writable realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        '*': ['read', 'write'],
      });

      test('serves a card-source POST request', async function (assert) {
        let entry = 'unused-card.gts';
        let expected = [
          {
            type: 'incremental-index-initiation',
            realmURL: testRealmURL.href,
            updatedFile: `${testRealmURL}unused-card.gts`,
          },
          {
            type: 'incremental',
            invalidations: [`${testRealmURL}unused-card.gts`],
            realmURL: testRealmURL.href,
            clientRequestId: null,
          },
        ];
        let response = await expectEvent({
          assert,
          expected,
          callback: async () => {
            return await request
              .post('/unused-card.gts')
              .set('Accept', 'application/vnd.card+source')
              .send(`//TEST UPDATE\n${cardSrc}`);
          },
        });

        assert.strictEqual(response.status, 204, 'HTTP 204 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );

        let srcFile = join(dir.name, 'realm_server_1', 'test', entry);
        assert.ok(existsSync(srcFile), 'card src exists');
        let src = readFileSync(srcFile, { encoding: 'utf8' });
        assert.codeEqual(
          src,
          `//TEST UPDATE
          ${cardSrc}`,
        );
      });

      test('serves a card-source POST request for a .txt file', async function (assert) {
        let response = await request
          .post('/hello-world.txt')
          .set('Accept', 'application/vnd.card+source')
          .send(`Hello World`);

        assert.strictEqual(response.status, 204, 'HTTP 204 status');

        let txtFile = join(
          dir.name,
          'realm_server_1',
          'test',
          'hello-world.txt',
        );
        assert.ok(existsSync(txtFile), 'file exists');
        let src = readFileSync(txtFile, { encoding: 'utf8' });
        assert.strictEqual(src, 'Hello World');
      });

      test('can serialize a card instance correctly after card definition is changed', async function (assert) {
        // create a card def
        {
          let expected = [
            {
              type: 'incremental-index-initiation',
              realmURL: testRealmURL.href,
              updatedFile: `${testRealmURL}test-card.gts`,
            },
            {
              type: 'incremental',
              invalidations: [`${testRealmURL}test-card.gts`],
              realmURL: testRealmURL.href,
              clientRequestId: null,
            },
          ];

          let response = await expectEvent({
            assert,
            expected,
            callback: async () => {
              return await request
                .post('/test-card.gts')
                .set('Accept', 'application/vnd.card+source').send(`
                import { contains, field, CardDef } from 'https://cardstack.com/base/card-api';
                import StringCard from 'https://cardstack.com/base/string';

                export class TestCard extends CardDef {
                  @field field1 = contains(StringCard);
                  @field field2 = contains(StringCard);
                }
              `);
            },
          });
          assert.strictEqual(response.status, 204, 'HTTP 204 status');
        }

        // make an instance of the card def
        let maybeId: string | undefined;
        {
          let response = await expectEvent({
            assert,
            expectedNumberOfEvents: 2,
            callback: async () => {
              return await request
                .post('/')
                .send({
                  data: {
                    type: 'card',
                    attributes: {
                      field1: 'a',
                      field2: 'b',
                    },
                    meta: {
                      adoptsFrom: {
                        module: `${testRealmURL}test-card`,
                        name: 'TestCard',
                      },
                    },
                  },
                })
                .set('Accept', 'application/vnd.card+json');
            },
          });
          assert.strictEqual(response.status, 201, 'HTTP 201 status');
          maybeId = response.body.data.id;
        }
        if (!maybeId) {
          assert.ok(false, 'new card identifier was undefined');
          // eslint-disable-next-line qunit/no-early-return
          return;
        }
        let id = maybeId;

        // modify field
        {
          let expected = [
            {
              type: 'incremental-index-initiation',
              realmURL: testRealmURL.href,
              updatedFile: `${testRealmURL}test-card.gts`,
            },
            {
              type: 'incremental',
              invalidations: [`${testRealmURL}test-card.gts`, id],
              realmURL: testRealmURL.href,
              clientRequestId: null,
            },
          ];

          let response = await expectEvent({
            assert,
            expected,
            callback: async () => {
              return await request
                .post('/test-card.gts')
                .set('Accept', 'application/vnd.card+source').send(`
                import { contains, field, CardDef } from 'https://cardstack.com/base/card-api';
                import StringCard from 'https://cardstack.com/base/string';

                export class TestCard extends CardDef {
                  @field field1 = contains(StringCard);
                  @field field2a = contains(StringCard); // rename field2 -> field2a
                }
              `);
            },
          });
          assert.strictEqual(response.status, 204, 'HTTP 204 status');
        }

        // verify serialization matches new card def
        {
          let response = await request
            .get(new URL(id).pathname)
            .set('Accept', 'application/vnd.card+json');

          assert.strictEqual(response.status, 200, 'HTTP 200 status');
          let json = response.body;
          assert.deepEqual(json.data.attributes, {
            field1: 'a',
            field2a: null,
            title: null,
            description: null,
            thumbnailURL: null,
          });
        }

        // set value on renamed field
        {
          let expected = [
            {
              type: 'incremental-index-initiation',
              realmURL: testRealmURL.href,
              updatedFile: `${id}.json`,
            },
            {
              type: 'incremental',
              invalidations: [id],
              realmURL: testRealmURL.href,
              clientRequestId: null,
            },
          ];
          let response = await expectEvent({
            assert,
            expected,
            callback: async () => {
              return await request
                .patch(new URL(id).pathname)
                .send({
                  data: {
                    type: 'card',
                    attributes: {
                      field2a: 'c',
                    },
                    meta: {
                      adoptsFrom: {
                        module: `${testRealmURL}test-card`,
                        name: 'TestCard',
                      },
                    },
                  },
                })
                .set('Accept', 'application/vnd.card+json');
            },
          });

          assert.strictEqual(response.status, 200, 'HTTP 200 status');
          assert.strictEqual(
            response.get('X-boxel-realm-url'),
            testRealmURL.href,
            'realm url header is correct',
          );
          assert.strictEqual(
            response.get('X-boxel-realm-public-readable'),
            'true',
            'realm is public readable',
          );

          let json = response.body;
          assert.deepEqual(json.data.attributes, {
            field1: 'a',
            field2a: 'c',
            title: null,
            description: null,
            thumbnailURL: null,
          });
        }

        // verify file serialization is correct
        {
          let localPath = new RealmPaths(testRealmURL).local(new URL(id));
          let jsonFile = `${join(
            dir.name,
            'realm_server_1',
            'test',
            localPath,
          )}.json`;
          let doc = JSON.parse(
            readFileSync(jsonFile, { encoding: 'utf8' }),
          ) as LooseSingleCardDocument;
          assert.deepEqual(
            doc,
            {
              data: {
                type: 'card',
                attributes: {
                  field1: 'a',
                  field2a: 'c',
                  title: null,
                  description: null,
                  thumbnailURL: null,
                },
                meta: {
                  adoptsFrom: {
                    module: '/test-card',
                    name: 'TestCard',
                  },
                },
              },
            },
            'instance serialized to filesystem correctly',
          );
        }

        // verify instance GET is correct
        {
          let response = await request
            .get(new URL(id).pathname)
            .set('Accept', 'application/vnd.card+json');

          assert.strictEqual(response.status, 200, 'HTTP 200 status');
          let json = response.body;
          assert.deepEqual(json.data.attributes, {
            field1: 'a',
            field2a: 'c',
            title: null,
            description: null,
            thumbnailURL: null,
          });
        }
      });
    });

    module('permissioned realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        john: ['read', 'write'],
      });

      test('401 with invalid JWT', async function (assert) {
        let response = await request
          .post('/unused-card.gts')
          .set('Accept', 'application/vnd.card+source')
          .send(`//TEST UPDATE\n${cardSrc}`)
          .set('Authorization', `Bearer invalid-token`);

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('401 without a JWT', async function (assert) {
        let response = await request
          .post('/unused-card.gts')
          .set('Accept', 'application/vnd.card+source')
          .send(`//TEST UPDATE\n${cardSrc}`); // no Authorization header

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('403 without permission', async function (assert) {
        let response = await request
          .post('/unused-card.gts')
          .set('Accept', 'application/vnd.card+source')
          .send(`//TEST UPDATE\n${cardSrc}`)
          .set('Authorization', `Bearer ${createJWT(testRealm, 'not-john')}`);

        assert.strictEqual(response.status, 403, 'HTTP 403 status');
      });

      test('204 with permission', async function (assert) {
        let response = await request
          .post('/unused-card.gts')
          .set('Accept', 'application/vnd.card+source')
          .send(`//TEST UPDATE\n${cardSrc}`)
          .set(
            'Authorization',
            `Bearer ${createJWT(testRealm, 'john', ['read', 'write'])}`,
          );

        assert.strictEqual(response.status, 204, 'HTTP 204 status');
      });
    });
  });

  module('directory GET request', function (_hooks) {
    module('public readable realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        '*': ['read'],
      });

      test('serves the request', async function (assert) {
        let response = await request
          .get('/dir/')
          .set('Accept', 'application/vnd.api+json');

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        let json = response.body;
        for (let relationship of Object.values(json.data.relationships)) {
          delete (relationship as any).meta.lastModified;
        }
        assert.deepEqual(
          json,
          {
            data: {
              id: `${testRealmHref}dir/`,
              type: 'directory',
              relationships: {
                'bar.txt': {
                  links: {
                    related: `${testRealmHref}dir/bar.txt`,
                  },
                  meta: {
                    kind: 'file',
                  },
                },
                'foo.txt': {
                  links: {
                    related: `${testRealmHref}dir/foo.txt`,
                  },
                  meta: {
                    kind: 'file',
                  },
                },
                'subdir/': {
                  links: {
                    related: `${testRealmHref}dir/subdir/`,
                  },
                  meta: {
                    kind: 'directory',
                  },
                },
              },
            },
          },
          'the directory response is correct',
        );
      });
    });

    module('permissioned realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        john: ['read'],
      });

      test('401 with invalid JWT', async function (assert) {
        let response = await request
          .get('/dir/')
          .set('Accept', 'application/vnd.api+json')
          .set('Authorization', `Bearer invalid-token`);

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('401 without a JWT', async function (assert) {
        let response = await request
          .get('/dir/')
          .set('Accept', 'application/vnd.api+json'); // no Authorization header

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('403 without permission', async function (assert) {
        let response = await request
          .get('/dir/')
          .set('Accept', 'application/vnd.api+json')
          .set('Authorization', `Bearer ${createJWT(testRealm, 'not-john')}`);

        assert.strictEqual(response.status, 403, 'HTTP 403 status');
      });

      test('200 with permission', async function (assert) {
        let response = await request
          .get('/dir/')
          .set('Accept', 'application/vnd.api+json')
          .set(
            'Authorization',
            `Bearer ${createJWT(testRealm, 'john', ['read'])}`,
          );

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
      });
    });
  });

  module('_search GET request', function (_hooks) {
    let query: Query = {
      filter: {
        on: {
          module: `${testRealmHref}person`,
          name: 'Person',
        },
        eq: {
          firstName: 'Mango',
        },
      },
    };

    module('public readable realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        '*': ['read'],
      });

      test('serves a /_search GET request', async function (assert) {
        let response = await request
          .get(`/_search?${stringify(query)}`)
          .set('Accept', 'application/vnd.card+json');

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        let json = response.body;
        assert.strictEqual(
          json.data.length,
          1,
          'the card is returned in the search results',
        );
        assert.strictEqual(
          json.data[0].id,
          `${testRealmHref}person-1`,
          'card ID is correct',
        );
      });
    });

    module('permissioned realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        john: ['read'],
      });

      test('401 with invalid JWT', async function (assert) {
        let response = await request
          .get(`/_search?${stringify(query)}`)
          .set('Accept', 'application/vnd.card+json');

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('401 without a JWT', async function (assert) {
        let response = await request
          .get(`/_search?${stringify(query)}`)
          .set('Accept', 'application/vnd.card+json'); // no Authorization header

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('403 without permission', async function (assert) {
        let response = await request
          .get(`/_search?${stringify(query)}`)
          .set('Accept', 'application/vnd.card+json')
          .set('Authorization', `Bearer ${createJWT(testRealm, 'not-john')}`);

        assert.strictEqual(response.status, 403, 'HTTP 403 status');
      });

      test('200 with permission', async function (assert) {
        let response = await request
          .get(`/_search?${stringify(query)}`)
          .set('Accept', 'application/vnd.card+json')
          .set(
            'Authorization',
            `Bearer ${createJWT(testRealm, 'john', ['read'])}`,
          );

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
      });
    });
  });

  module('/_search-prerendered GET request', function (_hooks) {
    module(
      'instances with no embedded template css of its own',
      function (hooks) {
        setupPermissionedRealm(
          hooks,
          {
            '*': ['read'],
          },
          {
            'person.gts': `
              import { contains, field, CardDef, Component } from "https://cardstack.com/base/card-api";
              import StringCard from "https://cardstack.com/base/string";

              export class Person extends CardDef {
                @field firstName = contains(StringCard);
                static isolated = class Isolated extends Component<typeof this> {
                  <template>
                    <h1><@fields.firstName/></h1>
                  </template>
                }
                static embedded = class Embedded extends Component<typeof this> {
                  <template>
                    Embedded Card Person: <@fields.firstName/>
                  </template>
                }
                static fitted = class Fitted extends Component<typeof this> {
                  <template>
                    Fitted Card Person: <@fields.firstName/>
                  </template>
                }
              }
            `,
            'john.json': {
              data: {
                attributes: {
                  firstName: 'John',
                },
                meta: {
                  adoptsFrom: {
                    module: './person',
                    name: 'Person',
                  },
                },
              },
            },
          },
        );

        test('endpoint will respond with a bad request if html format is not provided', async function (assert) {
          let response = await request
            .get(`/_search-prerendered`)
            .set('Accept', 'application/vnd.card+json');

          assert.strictEqual(response.status, 400, 'HTTP 200 status');

          assert.ok(
            response.body.errors[0].detail.includes(
              "Must include a 'prerenderedHtmlFormat' parameter with a value of 'embedded' or 'atom' to use this endpoint",
            ),
          );
        });

        test('returns prerendered instances', async function (assert) {
          let query: Query & { prerenderedHtmlFormat: string } = {
            filter: {
              on: {
                module: `${testRealmHref}person`,
                name: 'Person',
              },
              eq: {
                firstName: 'John',
              },
            },
            prerenderedHtmlFormat: 'embedded',
          };
          let response = await request
            .get(`/_search-prerendered?${stringify(query)}`)
            .set('Accept', 'application/vnd.card+json');

          assert.strictEqual(response.status, 200, 'HTTP 200 status');
          assert.strictEqual(
            response.get('X-boxel-realm-url'),
            testRealmURL.href,
            'realm url header is correct',
          );
          assert.strictEqual(
            response.get('X-boxel-realm-public-readable'),
            'true',
            'realm is public readable',
          );
          let json = response.body;

          assert.strictEqual(
            json.data.length,
            1,
            'one card instance is returned in the search results',
          );

          assert.strictEqual(json.data[0].type, 'prerendered-card');

          assert.true(
            json.data[0].attributes.html
              .replace(/\s+/g, ' ')
              .includes('Embedded Card Person: John'),
            'embedded html looks correct',
          );

          assertScopedCssUrlsContain(
            assert,
            json.meta.scopedCssUrls,
            cardDefModuleDependencies,
          );

          assert.strictEqual(json.meta.page.total, 1, 'total count is correct');
        });
      },
    );

    module('instances whose embedded template has css', function (hooks) {
      setupPermissionedRealm(
        hooks,
        {
          '*': ['read'],
        },
        {
          'person.gts': `
          import { contains, field, CardDef, Component } from "https://cardstack.com/base/card-api";
          import StringCard from "https://cardstack.com/base/string";

          export class Person extends CardDef {
            @field firstName = contains(StringCard);
            static isolated = class Isolated extends Component<typeof this> {
              <template>
                <h1><@fields.firstName/></h1>
              </template>
            }
            static embedded = class Embedded extends Component<typeof this> {
              <template>
                Embedded Card Person: <@fields.firstName/>

                <style scoped>
                  .border {
                    border: 1px solid red;
                  }
                </style>
              </template>
            }
          }
        `,
          'fancy-person.gts': `
          import { Person } from './person';
          import { contains, field, CardDef, Component } from "https://cardstack.com/base/card-api";
          import StringCard from "https://cardstack.com/base/string";

          export class FancyPerson extends Person {
            @field favoriteColor = contains(StringCard);

            static embedded = class Embedded extends Component<typeof this> {
              <template>
                Embedded Card FancyPerson: <@fields.firstName/>

                <style scoped>
                  .fancy-border {
                    border: 1px solid pink;
                  }
                </style>
              </template>
            }
          }
        `,
          'aaron.json': {
            data: {
              attributes: {
                firstName: 'Aaron',
                title: 'Person Aaron',
              },
              meta: {
                adoptsFrom: {
                  module: './person',
                  name: 'Person',
                },
              },
            },
          },
          'craig.json': {
            data: {
              attributes: {
                firstName: 'Craig',
                title: 'Person Craig',
              },
              meta: {
                adoptsFrom: {
                  module: './person',
                  name: 'Person',
                },
              },
            },
          },
          'jane.json': {
            data: {
              attributes: {
                firstName: 'Jane',
                favoriteColor: 'blue',
                title: 'FancyPerson Jane',
              },
              meta: {
                adoptsFrom: {
                  module: './fancy-person',
                  name: 'FancyPerson',
                },
              },
            },
          },
          'jimmy.json': {
            data: {
              attributes: {
                firstName: 'Jimmy',
                favoriteColor: 'black',
                title: 'FancyPerson Jimmy',
              },
              meta: {
                adoptsFrom: {
                  module: './fancy-person',
                  name: 'FancyPerson',
                },
              },
            },
          },
        },
      );

      test('returns instances with CardDef prerendered embedded html + css when there is no "on" filter', async function (assert) {
        let response = await request
          .get(`/_search-prerendered?prerenderedHtmlFormat=embedded`)
          .set('Accept', 'application/vnd.card+json');

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        let json = response.body;

        assert.strictEqual(
          json.data.length,
          4,
          'returned results count is correct',
        );

        // 1st card: Person Aaron
        assert.strictEqual(json.data[0].type, 'prerendered-card');
        assert.true(
          json.data[0].attributes.html
            .replace(/\s+/g, ' ')
            .includes('Person Aaron'),
          'embedded html looks correct (CardDef template)',
        );

        // 2nd card: Person Craig
        assert.strictEqual(json.data[1].type, 'prerendered-card');
        assert.true(
          json.data[1].attributes.html
            .replace(/\s+/g, ' ')
            .includes('Person Craig'),
          'embedded html for Craig looks correct (CardDef template)',
        );

        // 3rd card: FancyPerson Jane
        assert.strictEqual(json.data[2].type, 'prerendered-card');
        assert.true(
          json.data[2].attributes.html
            .replace(/\s+/g, ' ')
            .includes('FancyPerson Jane'),
          'embedded html for Jane looks correct (CardDef template)',
        );

        // 4th card: FancyPerson Jimmy
        assert.strictEqual(json.data[3].type, 'prerendered-card');
        assert.true(
          json.data[3].attributes.html
            .replace(/\s+/g, ' ')
            .includes('FancyPerson Jimmy'),
          'embedded html for Jimmy looks correct (CardDef template)',
        );

        assertScopedCssUrlsContain(
          assert,
          json.meta.scopedCssUrls,
          cardDefModuleDependencies,
        );

        assert.strictEqual(json.meta.page.total, 4, 'total count is correct');
      });

      test('returns correct css in relationships, even the one indexed in another realm (CardDef)', async function (assert) {
        let query: Query & { prerenderedHtmlFormat: string } = {
          filter: {
            on: {
              module: `${testRealmHref}fancy-person`,
              name: 'FancyPerson',
            },
            not: {
              eq: {
                firstName: 'Peter',
              },
            },
          },
          prerenderedHtmlFormat: 'embedded',
        };

        let response = await request
          .get(`/_search-prerendered?${stringify(query)}`)
          .set('Accept', 'application/vnd.card+json');

        let json = response.body;

        assert.strictEqual(
          json.data.length,
          2,
          'returned results count is correct',
        );

        // 1st card: FancyPerson Jane
        assert.true(
          json.data[0].attributes.html
            .replace(/\s+/g, ' ')
            .includes('Embedded Card FancyPerson: Jane'),
          'embedded html for Jane looks correct (FancyPerson template)',
        );

        //  2nd card: FancyPerson Jimmy
        assert.true(
          json.data[1].attributes.html
            .replace(/\s+/g, ' ')
            .includes('Embedded Card FancyPerson: Jimmy'),
          'embedded html for Jimmy looks correct (FancyPerson template)',
        );

        assertScopedCssUrlsContain(assert, json.meta.scopedCssUrls, [
          ...cardDefModuleDependencies,
          ...[`${testRealmHref}fancy-person.gts`, `${testRealmHref}person.gts`],
        ]);
      });

      test('can filter prerendered instances', async function (assert) {
        let query: Query & { prerenderedHtmlFormat: string } = {
          filter: {
            on: {
              module: `${testRealmHref}person`,
              name: 'Person',
            },
            eq: {
              firstName: 'Jimmy',
            },
          },
          prerenderedHtmlFormat: 'embedded',
        };
        let response = await request
          .get(`/_search-prerendered?${stringify(query)}`)
          .set('Accept', 'application/vnd.card+json');

        let json = response.body;

        assert.strictEqual(
          json.data.length,
          1,
          'one prerendered card instance is returned in the filtered search results',
        );
        assert.strictEqual(json.data[0].id, 'http://127.0.0.1:4444/jimmy.json');
      });

      test('can use cardUrls to filter prerendered instances', async function (assert) {
        let query: Query & {
          prerenderedHtmlFormat: string;
          cardUrls: string[];
        } = {
          prerenderedHtmlFormat: 'embedded',
          cardUrls: [`${testRealmHref}jimmy.json`],
        };
        let response = await request
          .get(`/_search-prerendered?${stringify(query)}`)
          .set('Accept', 'application/vnd.card+json');

        let json = response.body;

        assert.strictEqual(
          json.data.length,
          1,
          'one prerendered card instance is returned in the filtered search results',
        );
        assert.strictEqual(json.data[0].id, 'http://127.0.0.1:4444/jimmy.json');

        query = {
          prerenderedHtmlFormat: 'embedded',
          cardUrls: [`${testRealmHref}jimmy.json`, `${testRealmHref}jane.json`],
        };
        response = await request
          .get(`/_search-prerendered?${stringify(query)}`)
          .set('Accept', 'application/vnd.card+json');

        json = response.body;

        assert.strictEqual(
          json.data.length,
          2,
          '2 prerendered card instances are returned in the filtered search results',
        );
        assert.strictEqual(json.data[0].id, 'http://127.0.0.1:4444/jane.json');
        assert.strictEqual(json.data[1].id, 'http://127.0.0.1:4444/jimmy.json');
      });

      test('can sort prerendered instances', async function (assert) {
        let query: Query & { prerenderedHtmlFormat: string } = {
          sort: [
            {
              by: 'firstName',
              on: { module: `${testRealmHref}person`, name: 'Person' },
              direction: 'desc',
            },
          ],
          prerenderedHtmlFormat: 'embedded',
        };
        let response = await request
          .get(`/_search-prerendered?${stringify(query)}`)
          .set('Accept', 'application/vnd.card+json');

        let json = response.body;

        assert.strictEqual(json.data.length, 4, 'results count is correct');

        // firstName descending
        assert.strictEqual(json.data[0].id, 'http://127.0.0.1:4444/jimmy.json');
        assert.strictEqual(json.data[1].id, 'http://127.0.0.1:4444/jane.json');
        assert.strictEqual(json.data[2].id, 'http://127.0.0.1:4444/craig.json');
        assert.strictEqual(json.data[3].id, 'http://127.0.0.1:4444/aaron.json');
      });
    });
  });

  module('_info GET request', function (_hooks) {
    module('public readable realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        '*': ['read'],
      });

      test('serves the request', async function (assert) {
        let response = await request
          .get(`/_info`)
          .set('Accept', 'application/vnd.api+json');

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        let json = response.body;
        assert.deepEqual(
          json,
          {
            data: {
              id: testRealmHref,
              type: 'realm-info',
              attributes: testRealmInfo,
            },
          },
          '/_info response is correct',
        );
      });
    });

    module('permissioned realm', function (hooks) {
      setupPermissionedRealm(hooks, {
        john: ['read', 'write'],
      });

      test('401 with invalid JWT', async function (assert) {
        let response = await request
          .get(`/_info`)
          .set('Accept', 'application/vnd.api+json');

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('401 without a JWT', async function (assert) {
        let response = await request
          .get(`/_info`)
          .set('Accept', 'application/vnd.api+json'); // no Authorization header

        assert.strictEqual(response.status, 401, 'HTTP 401 status');
      });

      test('403 without permission', async function (assert) {
        let response = await request
          .get(`/_info`)
          .set('Accept', 'application/vnd.api+json')
          .set('Authorization', `Bearer ${createJWT(testRealm, 'not-john')}`);

        assert.strictEqual(response.status, 403, 'HTTP 403 status');
      });

      test('200 with permission', async function (assert) {
        let response = await request
          .get(`/_info`)
          .set('Accept', 'application/vnd.api+json')
          .set(
            'Authorization',
            `Bearer ${createJWT(testRealm, 'john', ['read', 'write'])}`,
          );

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        let json = response.body;
        assert.deepEqual(
          json,
          {
            data: {
              id: testRealmHref,
              type: 'realm-info',
              attributes: {
                ...testRealmInfo,
                visibility: 'private',
                realmUserId: '@node-test_realm:localhost',
              },
            },
          },
          '/_info response is correct',
        );
      });
    });

    module(
      'shared realm because there is `users` permission',
      function (hooks) {
        setupPermissionedRealm(hooks, {
          users: ['read'],
        });

        test('200 with permission', async function (assert) {
          let response = await request
            .get(`/_info`)
            .set('Accept', 'application/vnd.api+json')
            .set(
              'Authorization',
              `Bearer ${createJWT(testRealm, 'users', ['read'])}`,
            );

          assert.strictEqual(response.status, 200, 'HTTP 200 status');
          let json = response.body;
          assert.deepEqual(
            json,
            {
              data: {
                id: testRealmHref,
                type: 'realm-info',
                attributes: {
                  ...testRealmInfo,
                  visibility: 'shared',
                  realmUserId: '@node-test_realm:localhost',
                },
              },
            },
            '/_info response is correct',
          );
        });
      },
    );

    module('shared realm because there are multiple users', function (hooks) {
      setupPermissionedRealm(hooks, {
        bob: ['read'],
        jane: ['read'],
        john: ['read', 'write'],
      });

      test('200 with permission', async function (assert) {
        let response = await request
          .get(`/_info`)
          .set('Accept', 'application/vnd.api+json')
          .set(
            'Authorization',
            `Bearer ${createJWT(testRealm, 'john', ['read', 'write'])}`,
          );

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        let json = response.body;
        assert.deepEqual(
          json,
          {
            data: {
              id: testRealmHref,
              type: 'realm-info',
              attributes: {
                ...testRealmInfo,
                visibility: 'shared',
                realmUserId: '@node-test_realm:localhost',
              },
            },
          },
          '/_info response is correct',
        );
      });
    });
  });

  module('_user GET request', function (hooks) {
    setupPermissionedRealm(hooks, {
      john: ['read', 'write'],
    });

    test('user is not found', async function (assert) {
      let response = await request
        .get(`/_user`)
        .set('Accept', 'application/vnd.api+json')
        .set(
          'Authorization',
          `Bearer ${createJWT(testRealm, 'user', ['read', 'write'])}`,
        );
      assert.strictEqual(response.status, 404, 'HTTP 404 status');
    });

    test('subscription is not found', async function (assert) {
      let user = await insertUser(dbAdapter, 'user@test', 'cus_123');
      let response = await request
        .get(`/_user`)
        .set('Accept', 'application/vnd.api+json')
        .set(
          'Authorization',
          `Bearer ${createJWT(testRealm, 'user@test', ['read', 'write'])}`,
        );
      assert.strictEqual(response.status, 200, 'HTTP 200 status');
      let json = response.body;
      assert.deepEqual(
        json,
        {
          data: {
            type: 'user',
            id: user.id,
            attributes: {
              matrixUserId: user.matrixUserId,
              stripeCustomerId: user.stripeCustomerId,
              creditsAvailableInPlanAllowance: null,
              creditsIncludedInPlanAllowance: null,
              extraCreditsAvailableInBalance: null,
            },
            relationships: {
              subscription: null,
            },
          },
          included: null,
        },
        '/_user response is correct',
      );
    });

    test('user subscibes to a plan and has extra credit', async function (assert) {
      let user = await insertUser(dbAdapter, 'user@test', 'cus_123');
      let plan = await insertPlan(
        dbAdapter,
        'Creator',
        12,
        2500,
        'prod_creator',
      );
      let subscription = await insertSubscription(dbAdapter, {
        user_id: user.id,
        plan_id: plan.id,
        started_at: 1,
        status: 'active',
        stripe_subscription_id: 'sub_1234567890',
      });
      let subscriptionCycle = await insertSubscriptionCycle(dbAdapter, {
        subscriptionId: subscription.id,
        periodStart: 1,
        periodEnd: 2,
      });
      await addToCreditsLedger(dbAdapter, {
        userId: user.id,
        creditAmount: 100,
        creditType: 'extra_credit',
        subscriptionCycleId: subscriptionCycle.id,
      });
      await addToCreditsLedger(dbAdapter, {
        userId: user.id,
        creditAmount: 2500,
        creditType: 'plan_allowance',
        subscriptionCycleId: subscriptionCycle.id,
      });

      let response = await request
        .get(`/_user`)
        .set('Accept', 'application/vnd.api+json')
        .set(
          'Authorization',
          `Bearer ${createJWT(testRealm, 'user@test', ['read', 'write'])}`,
        );
      assert.strictEqual(response.status, 200, 'HTTP 200 status');
      let json = response.body;
      assert.deepEqual(
        json,
        {
          data: {
            type: 'user',
            id: user.id,
            attributes: {
              matrixUserId: user.matrixUserId,
              stripeCustomerId: user.stripeCustomerId,
              creditsAvailableInPlanAllowance: 2500,
              creditsIncludedInPlanAllowance: 2500,
              extraCreditsAvailableInBalance: 100,
            },
            relationships: {
              subscription: {
                data: {
                  type: 'subscription',
                  id: subscription.id,
                },
              },
            },
          },
          included: [
            {
              type: 'subscription',
              id: subscription.id,
              attributes: {
                startedAt: 1,
                endedAt: null,
                status: 'active',
              },
              relationships: {
                plan: {
                  data: {
                    type: 'plan',
                    id: plan.id,
                  },
                },
              },
            },
            {
              type: 'plan',
              id: plan.id,
              attributes: {
                name: plan.name,
                monthlyPrice: plan.monthlyPrice,
                creditsIncluded: plan.creditsIncluded,
              },
            },
          ],
        },
        '/_user response is correct',
      );
    });
  });

  module('various other realm tests', function (hooks) {
    let testRealmHttpServer2: Server;
    let testRealmServer2: RealmServer;
    let testRealm2: Realm;
    let dbAdapter: PgAdapter;
    let publisher: QueuePublisher;
    let runner: QueueRunner;
    let request2: SuperTest<Test>;
    let testRealmDir: string;

    hooks.beforeEach(async function () {
      shimExternals(virtualNetwork);
    });

    setupPermissionedRealm(hooks, {
      '*': ['read', 'write'],
    });

    async function startRealmServer(
      dbAdapter: PgAdapter,
      publisher: QueuePublisher,
      runner: QueueRunner,
    ) {
      if (testRealm2) {
        virtualNetwork.unmount(testRealm2.handle);
      }
      ({
        testRealm: testRealm2,
        testRealmServer: testRealmServer2,
        testRealmHttpServer: testRealmHttpServer2,
      } = await runTestRealmServer({
        virtualNetwork,
        testRealmDir,
        realmsRootPath: join(dir.name, 'realm_server_2'),
        realmURL: testRealm2URL,
        dbAdapter,
        publisher,
        runner,
        matrixURL,
      }));
      request2 = supertest(testRealmHttpServer2);
    }

    setupDB(hooks, {
      beforeEach: async (_dbAdapter, _publisher, _runner) => {
        dbAdapter = _dbAdapter;
        publisher = _publisher;
        runner = _runner;
        testRealmDir = join(dir.name, 'realm_server_2', 'test');
        ensureDirSync(testRealmDir);
        copySync(join(__dirname, 'cards'), testRealmDir);
        await startRealmServer(dbAdapter, publisher, runner);
      },
      afterEach: async () => {
        await closeServer(testRealmHttpServer2);
      },
    });

    test('POST /_create-realm', async function (assert) {
      // we randomize the realm and owner names so that we can isolate matrix
      // test state--there is no "delete user" matrix API
      let endpoint = `test-realm-${uuidv4()}`;
      let owner = 'mango';
      let ownerUserId = '@mango:boxel.ai';
      let response = await request2
        .post('/_create-realm')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/json')
        .set(
          'Authorization',
          `Bearer ${createRealmServerJWT(
            { user: ownerUserId, sessionRoom: 'session-room-test' },
            secretSeed,
          )}`,
        )
        .send(
          JSON.stringify({
            data: {
              type: 'realm',
              attributes: {
                ...testRealmInfo,
                endpoint,
                backgroundURL: 'http://example.com/background.jpg',
                iconURL: 'http://example.com/icon.jpg',
              },
            },
          }),
        );

      assert.strictEqual(response.status, 201, 'HTTP 201 status');
      let json = response.body;
      assert.deepEqual(
        json,
        {
          data: {
            type: 'realm',
            id: `${testRealm2URL.origin}/${owner}/${endpoint}/`,
            attributes: {
              ...testRealmInfo,
              endpoint,
              backgroundURL: 'http://example.com/background.jpg',
              iconURL: 'http://example.com/icon.jpg',
            },
          },
        },
        'realm creation JSON is correct',
      );

      let realmPath = join(dir.name, 'realm_server_2', owner, endpoint);
      let realmJSON = readJSONSync(join(realmPath, '.realm.json'));
      assert.deepEqual(
        realmJSON,
        {
          name: 'Test Realm',
          backgroundURL: 'http://example.com/background.jpg',
          iconURL: 'http://example.com/icon.jpg',
        },
        '.realm.json is correct',
      );
      assert.ok(
        existsSync(join(realmPath, 'index.json')),
        'seed file index.json exists',
      );
      assert.ok(
        existsSync(join(realmPath, 'hello-world.json')),
        'seed file hello-world.json exists',
      );
      assert.notOk(
        existsSync(join(realmPath, 'package.json')),
        'ignored seed file package.json does not exist',
      );
      assert.notOk(
        existsSync(join(realmPath, 'node_modules')),
        'ignored seed file node_modules/ does not exist',
      );
      assert.notOk(
        existsSync(join(realmPath, '.gitignore')),
        'ignored seed file .gitignore does not exist',
      );
      assert.notOk(
        existsSync(join(realmPath, 'tsconfig.json')),
        'ignored seed file tsconfig.json does not exist',
      );

      let permissions = await fetchUserPermissions(
        dbAdapter,
        new URL(json.data.id),
      );
      assert.deepEqual(permissions, {
        [`@realm/mango_${endpoint}:localhost`]: [
          'read',
          'write',
          'realm-owner',
        ],
        [ownerUserId]: ['read', 'write', 'realm-owner'],
      });

      let id: string;
      let realm = testRealmServer2.testingOnlyRealms.find(
        (r) => r.url === json.data.id,
      )!;
      {
        // owner can create an instance
        let response = await request2
          .post(`/${owner}/${endpoint}/`)
          .send({
            data: {
              type: 'card',
              attributes: {
                title: 'Test Card',
              },
              meta: {
                adoptsFrom: {
                  module: 'https://cardstack.com/base/card-api',
                  name: 'CardDef',
                },
              },
            },
          })
          .set('Accept', 'application/vnd.card+json')
          .set(
            'Authorization',
            `Bearer ${createJWT(realm, ownerUserId, [
              'read',
              'write',
              'realm-owner',
            ])}`,
          );

        assert.strictEqual(response.status, 201, 'HTTP 201 status');
        let doc = response.body as SingleCardDocument;
        id = doc.data.id;
      }

      {
        // owner can get an instance
        let response = await request2
          .get(new URL(id).pathname)
          .set('Accept', 'application/vnd.card+json')
          .set(
            'Authorization',
            `Bearer ${createJWT(realm, ownerUserId, [
              'read',
              'write',
              'realm-owner',
            ])}`,
          );

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        let doc = response.body as SingleCardDocument;
        assert.strictEqual(
          doc.data.attributes?.title,
          'Test Card',
          'instance data is correct',
        );
      }

      {
        // owner can search in the realm
        let response = await request2
          .get(
            `${new URL(realm.url).pathname}_search?${stringify({
              filter: {
                on: baseCardRef,
                eq: {
                  title: 'Test Card',
                },
              },
            } as Query)}`,
          )
          .set('Accept', 'application/vnd.card+json')
          .set(
            'Authorization',
            `Bearer ${createJWT(realm, ownerUserId, [
              'read',
              'write',
              'realm-owner',
            ])}`,
          );

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        let results = response.body as CardCollectionDocument;
        assert.strictEqual(results.data.length, 1),
          'correct number of search results';
      }
    });

    test('dynamically created realms are not publicly readable or writable', async function (assert) {
      let endpoint = `test-realm-${uuidv4()}`;
      let owner = 'mango';
      let ownerUserId = '@mango:boxel.ai';
      let response = await request2
        .post('/_create-realm')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/json')
        .set(
          'Authorization',
          `Bearer ${createRealmServerJWT(
            { user: ownerUserId, sessionRoom: 'session-room-test' },
            secretSeed,
          )}`,
        )
        .send(
          JSON.stringify({
            data: {
              type: 'realm',
              attributes: {
                name: 'Test Realm',
                endpoint,
              },
            },
          }),
        );

      let realmURL = response.body.data.id;
      assert.strictEqual(response.status, 201, 'HTTP 201 status');
      let realm = testRealmServer2.testingOnlyRealms.find(
        (r) => r.url === realmURL,
      )!;

      {
        let response = await request2
          .get(
            `${new URL(realmURL).pathname}_search?${stringify({
              filter: {
                on: baseCardRef,
                eq: {
                  title: 'Test Card',
                },
              },
            } as Query)}`,
          )
          .set('Accept', 'application/vnd.card+json')
          .set('Authorization', `Bearer ${createJWT(realm, 'rando')}`);

        assert.strictEqual(response.status, 403, 'HTTP 403 status');

        response = await request2
          .post(`/${owner}/${endpoint}/`)
          .send({
            data: {
              type: 'card',
              attributes: {
                title: 'Test Card',
              },
              meta: {
                adoptsFrom: {
                  module: 'https://cardstack.com/base/card-api',
                  name: 'CardDef',
                },
              },
            },
          })
          .set('Accept', 'application/vnd.card+json')
          .set('Authorization', `Bearer ${createJWT(realm, 'rando')}`);

        assert.strictEqual(response.status, 403, 'HTTP 403 status');
      }
    });

    test('can restart a realm that was created dynamically', async function (assert) {
      let endpoint = `test-realm-${uuidv4()}`;
      let owner = 'mango';
      let ownerUserId = '@mango:boxel.ai';
      let realmURL: string;
      {
        let response = await request2
          .post('/_create-realm')
          .set('Accept', 'application/vnd.api+json')
          .set('Content-Type', 'application/json')
          .set(
            'Authorization',
            `Bearer ${createRealmServerJWT(
              { user: '@mango:boxel.ai', sessionRoom: 'session-room-test' },
              secretSeed,
            )}`,
          )
          .send(
            JSON.stringify({
              data: {
                type: 'realm',
                attributes: {
                  name: 'Test Realm',
                  endpoint,
                },
              },
            }),
          );
        assert.strictEqual(response.status, 201, 'HTTP 201 status');
        realmURL = response.body.data.id;
      }

      let id: string;
      let realm = testRealmServer2.testingOnlyRealms.find(
        (r) => r.url === realmURL,
      )!;
      {
        let response = await request2
          .post(`/${owner}/${endpoint}/`)
          .send({
            data: {
              type: 'card',
              attributes: {
                title: 'Test Card',
              },
              meta: {
                adoptsFrom: {
                  module: 'https://cardstack.com/base/card-api',
                  name: 'CardDef',
                },
              },
            },
          })
          .set('Accept', 'application/vnd.card+json')
          .set(
            'Authorization',
            `Bearer ${createJWT(realm, ownerUserId, [
              'read',
              'write',
              'realm-owner',
            ])}`,
          );

        assert.strictEqual(response.status, 201, 'HTTP 201 status');
        id = response.body.data.id;
      }

      // Stop and restart the server
      testRealmServer2.testingOnlyUnmountRealms();
      await closeServer(testRealmHttpServer2);
      await startRealmServer(dbAdapter, publisher, runner);
      await testRealmServer2.start();

      {
        let response = await request2
          .get(new URL(id).pathname)
          .set('Accept', 'application/vnd.card+json')
          .set(
            'Authorization',
            `Bearer ${createJWT(realm, ownerUserId, [
              'read',
              'write',
              'realm-owner',
            ])}`,
          );

        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        let doc = response.body as SingleCardDocument;
        assert.strictEqual(
          doc.data.attributes?.title,
          'Test Card',
          'instance data is correct',
        );
      }
    });

    test('POST /_create-realm without JWT', async function (assert) {
      let endpoint = `test-realm-${uuidv4()}`;
      let response = await request2
        .post('/_create-realm')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/json')
        .send(
          JSON.stringify({
            data: {
              type: 'realm',
              attributes: {
                name: 'Test Realm',
                endpoint,
              },
            },
          }),
        );
      assert.strictEqual(response.status, 401, 'HTTP 401 status');
      let error = response.body.errors[0];
      assert.strictEqual(
        error,
        'Missing Authorization header',
        'error message is correct',
      );
    });

    test('POST /_create-realm with invalid JWT', async function (assert) {
      let endpoint = `test-realm-${uuidv4()}`;
      let response = await request2
        .post('/_create-realm')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer invalid-jwt')
        .send(
          JSON.stringify({
            data: {
              type: 'realm',
              attributes: {
                name: 'Test Realm',
                endpoint,
              },
            },
          }),
        );
      assert.strictEqual(response.status, 401, 'HTTP 401 status');
      let error = response.body.errors[0];
      assert.strictEqual(error, 'Token invalid', 'error message is correct');
    });

    test('POST /_create-realm with invalid JSON', async function (assert) {
      let response = await request2
        .post('/_create-realm')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/json')
        .set(
          'Authorization',
          `Bearer ${createRealmServerJWT(
            { user: '@mango:boxel.ai', sessionRoom: 'session-room-test' },
            secretSeed,
          )}`,
        )
        .send('make a new realm please!');
      assert.strictEqual(response.status, 400, 'HTTP 400 status');
      let error = response.body.errors[0];
      assert.ok(error.match(/not valid JSON-API/), 'error message is correct');
    });

    test('POST /_create-realm with bad JSON-API', async function (assert) {
      let response = await request2
        .post('/_create-realm')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/json')
        .set(
          'Authorization',
          `Bearer ${createRealmServerJWT(
            { user: '@mango:boxel.ai', sessionRoom: 'session-room-test' },
            secretSeed,
          )}`,
        )
        .send(
          JSON.stringify({
            name: 'mango-realm',
          }),
        );
      assert.strictEqual(response.status, 400, 'HTTP 400 status');
      let error = response.body.errors[0];
      assert.ok(error.match(/not valid JSON-API/), 'error message is correct');
    });

    test('POST /_create-realm without a realm endpoint', async function (assert) {
      let response = await request2
        .post('/_create-realm')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/json')
        .set(
          'Authorization',
          `Bearer ${createRealmServerJWT(
            { user: '@mango:boxel.ai', sessionRoom: 'session-room-test' },
            secretSeed,
          )}`,
        )
        .send(
          JSON.stringify({
            data: {
              type: 'realm',
              attributes: {
                name: 'Test Realm',
              },
            },
          }),
        );
      assert.strictEqual(response.status, 400, 'HTTP 400 status');
      let error = response.body.errors[0];
      assert.ok(
        error.match(/endpoint is required and must be a string/),
        'error message is correct',
      );
    });

    test('POST /_create-realm without a realm name', async function (assert) {
      let endpoint = `test-realm-${uuidv4()}`;
      let response = await request2
        .post('/_create-realm')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/json')
        .set(
          'Authorization',
          `Bearer ${createRealmServerJWT(
            { user: '@mango:boxel.ai', sessionRoom: 'session-room-test' },
            secretSeed,
          )}`,
        )
        .send(
          JSON.stringify({
            data: {
              type: 'realm',
              attributes: {
                endpoint,
              },
            },
          }),
        );
      assert.strictEqual(response.status, 400, 'HTTP 400 status');
      let error = response.body.errors[0];
      assert.ok(
        error.match(/name is required and must be a string/),
        'error message is correct',
      );
    });

    test('cannot create a realm on a realm server that has a realm mounted at the origin', async function (assert) {
      let response = await request
        .post('/_create-realm')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/json')
        .set(
          'Authorization',
          `Bearer ${createRealmServerJWT(
            { user: '@mango:boxel.ai', sessionRoom: 'session-room-test' },
            secretSeed,
          )}`,
        )
        .send(
          JSON.stringify({
            data: {
              type: 'realm',
              attributes: {
                endpoint: 'mango-realm',
                name: 'Test Realm',
              },
            },
          }),
        );
      assert.strictEqual(response.status, 400, 'HTTP 400 status');
      let error = response.body.errors[0];
      assert.ok(
        error.match(/a realm is already mounted at the origin of this server/),
        'error message is correct',
      );
    });

    test('cannot create a new realm that collides with an existing realm', async function (assert) {
      let endpoint = `test-realm-${uuidv4()}`;
      let ownerUserId = '@mango:boxel.ai';
      let response = await request2
        .post('/_create-realm')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/json')
        .set(
          'Authorization',
          `Bearer ${createRealmServerJWT(
            { user: ownerUserId, sessionRoom: 'session-room-test' },
            secretSeed,
          )}`,
        )
        .send(
          JSON.stringify({
            data: {
              type: 'realm',
              attributes: {
                endpoint,
                name: 'Test Realm',
              },
            },
          }),
        );
      assert.strictEqual(response.status, 201, 'HTTP 201 status');
      {
        let response = await request2
          .post('/_create-realm')
          .set('Accept', 'application/vnd.api+json')
          .set('Content-Type', 'application/json')
          .set(
            'Authorization',
            `Bearer ${createRealmServerJWT(
              { user: ownerUserId, sessionRoom: 'session-room-test' },
              secretSeed,
            )}`,
          )
          .send(
            JSON.stringify({
              data: {
                type: 'realm',
                attributes: {
                  endpoint,
                  name: 'Another Test Realm',
                },
              },
            }),
          );
        assert.strictEqual(response.status, 400, 'HTTP 400 status');
        let error = response.body.errors[0];
        assert.ok(
          error.match(/already exists on this server/),
          'error message is correct',
        );
      }
    });

    test('cannot create a realm with invalid characters in endpoint', async function (assert) {
      let ownerUserId = '@mango:boxel.ai';
      {
        let response = await request2
          .post('/_create-realm')
          .set('Accept', 'application/vnd.api+json')
          .set('Content-Type', 'application/json')
          .set(
            'Authorization',
            `Bearer ${createRealmServerJWT(
              { user: ownerUserId, sessionRoom: 'session-room-test' },
              secretSeed,
            )}`,
          )
          .send(
            JSON.stringify({
              data: {
                type: 'realm',
                attributes: {
                  endpoint: 'invalid_realm_endpoint',
                  name: 'Test Realm',
                },
              },
            }),
          );
        assert.strictEqual(response.status, 400, 'HTTP 400 status');
        let error = response.body.errors[0];
        assert.ok(
          error.match(/contains invalid characters/),
          'error message is correct',
        );
      }
      {
        let response = await request2
          .post('/_create-realm')
          .set('Accept', 'application/vnd.api+json')
          .set('Content-Type', 'application/json')
          .set(
            'Authorization',
            `Bearer ${createRealmServerJWT(
              { user: ownerUserId, sessionRoom: 'session-room-test' },
              secretSeed,
            )}`,
          )
          .send(
            JSON.stringify({
              data: {
                type: 'realm',
                attributes: {
                  endpoint: 'invalid realm endpoint',
                  name: 'Test Realm',
                },
              },
            }),
          );
        assert.strictEqual(response.status, 400, 'HTTP 400 status');
        let error = response.body.errors[0];
        assert.ok(
          error.match(/contains invalid characters/),
          'error message is correct',
        );
      }
    });

    test('returns 404 for request that has malformed URI', async function (assert) {
      let response = await request2.get('/%c0').set('Accept', '*/*');
      assert.strictEqual(response.status, 404, 'HTTP 404 status');
    });

    test('can dynamically load a card definition from own realm', async function (assert) {
      let ref = {
        module: `${testRealmHref}person`,
        name: 'Person',
      };
      await loadCard(ref, { loader });
      let doc = {
        data: {
          attributes: { firstName: 'Mango' },
          meta: { adoptsFrom: ref },
        },
      };
      let api = await loader.import<typeof CardAPI>(
        'https://cardstack.com/base/card-api',
      );
      let person = await api.createFromSerialized<any>(
        doc.data,
        doc,
        undefined,
      );
      assert.strictEqual(person.firstName, 'Mango', 'card data is correct');
    });

    test('can dynamically load a card definition from a different realm', async function (assert) {
      let ref = {
        module: `${testRealm2Href}person`,
        name: 'Person',
      };
      await loadCard(ref, { loader });
      let doc = {
        data: {
          attributes: { firstName: 'Mango' },
          meta: { adoptsFrom: ref },
        },
      };
      let api = await loader.import<typeof CardAPI>(
        'https://cardstack.com/base/card-api',
      );
      let person = await api.createFromSerialized<any>(
        doc.data,
        doc,
        undefined,
      );
      assert.strictEqual(person.firstName, 'Mango', 'card data is correct');
    });

    test('can instantiate a card that uses a code-ref field', async function (assert) {
      let adoptsFrom = {
        module: `${testRealm2Href}code-ref-test`,
        name: 'TestCard',
      };
      await loadCard(adoptsFrom, { loader });
      let ref = { module: `${testRealm2Href}person`, name: 'Person' };
      let doc = {
        data: {
          attributes: { ref },
          meta: { adoptsFrom },
        },
      };
      let api = await loader.import<typeof CardAPI>(
        'https://cardstack.com/base/card-api',
      );
      let testCard = await api.createFromSerialized<any>(
        doc.data,
        doc,
        undefined,
      );
      assert.deepEqual(testCard.ref, ref, 'card data is correct');
    });

    test('can index a newly added file to the filesystem', async function (assert) {
      {
        let response = await request
          .get('/new-card')
          .set('Accept', 'application/vnd.card+json');
        assert.strictEqual(response.status, 404, 'HTTP 404 status');
      }
      let expected = [
        {
          type: 'incremental-index-initiation',
          realmURL: testRealmURL.href,
          updatedFile: `${testRealmURL}new-card.json`,
        },
        {
          type: 'incremental',
          realmURL: testRealmURL.href,
          invalidations: [`${testRealmURL}new-card`],
        },
      ];
      await expectEvent({
        assert,
        expected,
        callback: async () => {
          writeJSONSync(
            join(dir.name, 'realm_server_1', 'test', 'new-card.json'),
            {
              data: {
                attributes: {
                  firstName: 'Mango',
                },
                meta: {
                  adoptsFrom: {
                    module: './person',
                    name: 'Person',
                  },
                },
              },
            } as LooseSingleCardDocument,
          );
        },
      });

      {
        let response = await request
          .get('/new-card')
          .set('Accept', 'application/vnd.card+json');
        assert.strictEqual(response.status, 200, 'HTTP 200 status');
        let json = response.body;
        assert.ok(json.data.meta.lastModified, 'lastModified exists');
        delete json.data.meta.lastModified;
        delete json.data.meta.resourceCreatedAt;
        assert.strictEqual(
          response.get('X-boxel-realm-url'),
          testRealmURL.href,
          'realm url header is correct',
        );
        assert.strictEqual(
          response.get('X-boxel-realm-public-readable'),
          'true',
          'realm is public readable',
        );
        assert.deepEqual(json, {
          data: {
            id: `${testRealmHref}new-card`,
            type: 'card',
            attributes: {
              title: 'Mango',
              firstName: 'Mango',
              description: null,
              thumbnailURL: null,
            },
            meta: {
              adoptsFrom: {
                module: `./person`,
                name: 'Person',
              },
              realmInfo: testRealmInfo,
              realmURL: testRealmURL.href,
            },
            links: {
              self: `${testRealmHref}new-card`,
            },
          },
        });
      }
    });

    test('can index a changed file in the filesystem', async function (assert) {
      {
        let response = await request
          .get('/person-1')
          .set('Accept', 'application/vnd.card+json');
        let json = response.body as LooseSingleCardDocument;
        assert.strictEqual(
          json.data.attributes?.firstName,
          'Mango',
          'initial firstName value is correct',
        );
      }

      let expected = [
        {
          type: 'incremental-index-initiation',
          realmURL: testRealmURL.href,
          updatedFile: `${testRealmURL}person-1.json`,
        },
        {
          type: 'incremental',
          realmURL: testRealmURL.href,
          invalidations: [`${testRealmURL}person-1`],
        },
      ];
      await expectEvent({
        assert,
        expected,
        callback: async () => {
          writeJSONSync(
            join(dir.name, 'realm_server_1', 'test', 'person-1.json'),
            {
              data: {
                type: 'card',
                attributes: {
                  firstName: 'Van Gogh',
                },
                meta: {
                  adoptsFrom: {
                    module: './person.gts',
                    name: 'Person',
                  },
                },
              },
            } as LooseSingleCardDocument,
          );
        },
      });

      {
        let response = await request
          .get('/person-1')
          .set('Accept', 'application/vnd.card+json');
        let json = response.body as LooseSingleCardDocument;
        assert.strictEqual(
          json.data.attributes?.firstName,
          'Van Gogh',
          'updated firstName value is correct',
        );
      }
    });

    test('can index a file deleted from the filesystem', async function (assert) {
      {
        let response = await request
          .get('/person-1')
          .set('Accept', 'application/vnd.card+json');
        assert.strictEqual(response.status, 200, 'HTTP 200 status');
      }

      let expected = [
        {
          type: 'incremental-index-initiation',
          realmURL: testRealmURL.href,
          updatedFile: `${testRealmURL}person-1.json`,
        },
        {
          type: 'incremental',
          realmURL: testRealmURL.href,
          invalidations: [`${testRealmURL}person-1`],
        },
      ];
      await expectEvent({
        assert,
        expected,
        callback: async () => {
          removeSync(join(dir.name, 'realm_server_1', 'test', 'person-1.json'));
        },
      });

      {
        let response = await request
          .get('/person-1')
          .set('Accept', 'application/vnd.card+json');
        assert.strictEqual(response.status, 404, 'HTTP 404 status');
      }
    });

    test('can make HEAD request to get realmURL and isPublicReadable status', async function (assert) {
      let response = await request
        .head('/person-1')
        .set('Accept', 'application/vnd.card+json');

      assert.strictEqual(response.status, 200, 'HTTP 200 status');
      assert.strictEqual(
        response.headers['x-boxel-realm-url'],
        testRealmURL.href,
      );
      assert.strictEqual(
        response.headers['x-boxel-realm-public-readable'],
        'true',
      );
    });

    test('can fetch card type summary', async function (assert) {
      let response = await request
        .get('/_types')
        .set('Accept', 'application/json');

      assert.strictEqual(response.status, 200, 'HTTP 200 status');
      assert.deepEqual(response.body, {
        data: [
          {
            type: 'card-type-summary',
            id: `${testRealm.url}friend/Friend`,
            attributes: {
              displayName: 'Friend',
              total: 2,
            },
          },
          {
            type: 'card-type-summary',
            id: `${testRealm.url}home/Home`,
            attributes: {
              displayName: 'Home',
              total: 1,
            },
          },
          {
            type: 'card-type-summary',
            id: `${testRealm.url}person/Person`,
            attributes: {
              displayName: 'Person',
              total: 3,
            },
          },
        ],
      });
    });

    test('can fetch catalog realms', async function (assert) {
      let response = await request2
        .get('/_catalog-realms')
        .set('Accept', 'application/json');

      assert.strictEqual(response.status, 200, 'HTTP 200 status');
      assert.deepEqual(response.body, {
        data: [
          {
            type: 'catalog-realm',
            id: `${testRealm2URL}`,
            attributes: testRealmInfo,
          },
        ],
      });
    });

    test(`returns 200 with empty data if failed to fetch catalog realm's info`, async function (assert) {
      virtualNetwork.mount(
        async (req: Request) => {
          if (req.url.includes('_info')) {
            return new Response('Failed to fetch realm info', {
              status: 500,
              statusText: 'Internal Server Error',
            });
          }
          return null;
        },
        { prepend: true },
      );
      let response = await request2
        .get('/_catalog-realms')
        .set('Accept', 'application/json');

      assert.strictEqual(response.status, 200, 'HTTP 200 status');
      assert.deepEqual(response.body, {
        data: [],
      });
    });
  });

  module('stripe webhook handler', function (hooks) {
    let createSubscriptionStub: sinon.SinonStub;
    let fetchPriceListStub: sinon.SinonStub;
    let matrixClient: MatrixClient;
    let roomId: string;
    let userId = '@test_realm:localhost';
    let waitForBillingNotification = async function (
      assert: Assert,
      done: () => void,
    ) {
      let messages = await matrixClient.roomMessages(roomId);
      if (messages[0].content.msgtype === 'org.boxel.realm-server-event') {
        assert.strictEqual(
          messages[0].content.body,
          JSON.stringify({ eventType: 'billing-notification' }),
        );
        done();
      } else {
        setTimeout(() => waitForBillingNotification(assert, done), 1);
      }
    };

    setupPermissionedRealm(hooks, {
      '*': ['read', 'write'],
    });

    hooks.beforeEach(async function () {
      shimExternals(virtualNetwork);
      let stripe = getStripe();
      createSubscriptionStub = sinon.stub(stripe.subscriptions, 'create');
      fetchPriceListStub = sinon.stub(stripe.prices, 'list');

      matrixClient = new MatrixClient({
        matrixURL: realmServerTestMatrix.url,
        username: 'test_realm',
        seed: secretSeed,
      });
      await matrixClient.login();
      let userId = matrixClient.getUserId();

      let response = await request
        .post('/_server-session')
        .send(JSON.stringify({ user: userId }))
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');
      let json = response.body;

      let { joined_rooms: rooms } = await matrixClient.getJoinedRooms();

      if (!rooms.includes(json.room)) {
        await matrixClient.joinRoom(json.room);
      }

      await matrixClient.sendEvent(json.room, 'm.room.message', {
        body: `auth-response: ${json.challenge}`,
        msgtype: 'm.text',
      });

      response = await request
        .post('/_server-session')
        .send(JSON.stringify({ user: userId, challenge: json.challenge }))
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');
      roomId = json.room;
    });

    hooks.afterEach(async function () {
      createSubscriptionStub.restore();
      fetchPriceListStub.restore();
    });

    test('subscribes user back to free plan when the current subscription is expired', async function (assert) {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      let user = await insertUser(dbAdapter, userId, 'cus_123');
      let freePlan = await insertPlan(
        dbAdapter,
        'Free plan',
        0,
        100,
        'prod_free',
      );
      let creatorPlan = await insertPlan(
        dbAdapter,
        'Creator',
        12,
        5000,
        'prod_creator',
      );

      if (!secret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not set');
      }
      let stripeInvoicePaymentSucceededEvent = {
        id: 'evt_1234567890',
        object: 'event',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_1234567890',
            object: 'invoice',
            amount_paid: 12,
            billing_reason: 'subscription_create',
            period_end: 1638465600,
            period_start: 1635873600,
            subscription: 'sub_1234567890',
            customer: 'cus_123',
            lines: {
              data: [
                {
                  amount: 12,
                  price: { product: 'prod_creator' },
                },
              ],
            },
          },
        },
      };

      let timestamp = Math.floor(Date.now() / 1000);
      let stripeInvoicePaymentSucceededPayload = JSON.stringify(
        stripeInvoicePaymentSucceededEvent,
      );
      let stripeInvoicePaymentSucceededSignature =
        Stripe.webhooks.generateTestHeaderString({
          payload: stripeInvoicePaymentSucceededPayload,
          secret,
          timestamp,
        });
      await request
        .post('/_stripe-webhook')
        .send(stripeInvoicePaymentSucceededPayload)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', stripeInvoicePaymentSucceededSignature);

      let subscriptions = await fetchSubscriptionsByUserId(dbAdapter, user.id);
      assert.strictEqual(subscriptions.length, 1);
      assert.strictEqual(subscriptions[0].status, 'active');
      assert.strictEqual(subscriptions[0].planId, creatorPlan.id);

      let waitForSubscriptionExpiryProcessed = new Deferred<void>();
      let waitForFreePlanSubscriptionProcessed = new Deferred<void>();

      // A function to simulate webhook call from stripe after we call 'stripe.subscription.create' endpoint
      let subscribeToFreePlan = async function () {
        await waitForSubscriptionExpiryProcessed.promise;
        let stripeInvoicePaymentSucceededEvent = {
          id: 'evt_1234567892',
          object: 'event',
          type: 'invoice.payment_succeeded',
          data: {
            object: {
              id: 'in_1234567890',
              object: 'invoice',
              amount_paid: 0, // free plan
              billing_reason: 'subscription_create',
              period_end: 1638465600,
              period_start: 1635873600,
              subscription: 'sub_1234567890',
              customer: 'cus_123',
              lines: {
                data: [
                  {
                    amount: 0,
                    price: { product: 'prod_free' },
                  },
                ],
              },
            },
          },
        };
        let stripeInvoicePaymentSucceededPayload = JSON.stringify(
          stripeInvoicePaymentSucceededEvent,
        );
        let stripeInvoicePaymentSucceededSignature =
          Stripe.webhooks.generateTestHeaderString({
            payload: stripeInvoicePaymentSucceededPayload,
            secret,
            timestamp,
          });
        await request
          .post('/_stripe-webhook')
          .send(stripeInvoicePaymentSucceededPayload)
          .set('Accept', 'application/json')
          .set('Content-Type', 'application/json')
          .set('stripe-signature', stripeInvoicePaymentSucceededSignature);
        waitForFreePlanSubscriptionProcessed.fulfill();
      };
      const createSubscriptionResponse = {
        id: 'sub_1MowQVLkdIwHu7ixeRlqHVzs',
        object: 'subscription',
        automatic_tax: {
          enabled: false,
        },
        billing_cycle_anchor: 1679609767,
        cancel_at_period_end: false,
        collection_method: 'charge_automatically',
        created: 1679609767,
        currency: 'usd',
        current_period_end: 1682288167,
        current_period_start: 1679609767,
        customer: 'cus_123',
        invoice_settings: {
          issuer: {
            type: 'self',
          },
        },
      };
      createSubscriptionStub.callsFake(() => {
        subscribeToFreePlan();
        return createSubscriptionResponse;
      });

      let fetchPriceListResponse = {
        object: 'list',
        data: [
          {
            id: 'price_1QMRCxH9rBd1yAHRD4BXhAHW',
            object: 'price',
            active: true,
            billing_scheme: 'per_unit',
            created: 1731921923,
            currency: 'usd',
            custom_unit_amount: null,
            livemode: false,
            lookup_key: null,
            metadata: {},
            nickname: null,
            product: 'prod_REv3E69DbAPv4K',
            recurring: {
              aggregate_usage: null,
              interval: 'month',
              interval_count: 1,
              meter: null,
              trial_period_days: null,
              usage_type: 'licensed',
            },
            tax_behavior: 'unspecified',
            tiers_mode: null,
            transform_quantity: null,
            type: 'recurring',
            unit_amount: 0,
            unit_amount_decimal: '0',
          },
        ],
        has_more: false,
        url: '/v1/prices',
      };
      fetchPriceListStub.resolves(fetchPriceListResponse);

      let stripeSubscriptionDeletedEvent = {
        id: 'evt_sub_deleted_1',
        object: 'event',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_1234567890',
            canceled_at: 2,
            cancellation_details: {
              reason: 'payment_failure',
            },
          },
        },
      };
      let stripeSubscriptionDeletedPayload = JSON.stringify(
        stripeSubscriptionDeletedEvent,
      );
      let stripeSubscriptionDeletedSignature =
        Stripe.webhooks.generateTestHeaderString({
          payload: stripeSubscriptionDeletedPayload,
          secret,
          timestamp,
        });
      await request
        .post('/_stripe-webhook')
        .send(stripeSubscriptionDeletedPayload)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', stripeSubscriptionDeletedSignature);
      waitForSubscriptionExpiryProcessed.fulfill();

      await waitForFreePlanSubscriptionProcessed.promise;
      subscriptions = await fetchSubscriptionsByUserId(dbAdapter, user.id);
      assert.strictEqual(subscriptions.length, 2);
      assert.strictEqual(subscriptions[0].status, 'expired');
      assert.strictEqual(subscriptions[0].planId, creatorPlan.id);

      assert.strictEqual(subscriptions[1].status, 'active');
      assert.strictEqual(subscriptions[1].planId, freePlan.id);
      waitForBillingNotification(assert, assert.async());
    });

    test('ensures the current subscription expires when free plan subscription fails', async function (assert) {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      let user = await insertUser(dbAdapter, userId, 'cus_123');
      await insertPlan(dbAdapter, 'Free plan', 0, 100, 'prod_free');
      let creatorPlan = await insertPlan(
        dbAdapter,
        'Creator',
        12,
        5000,
        'prod_creator',
      );

      if (!secret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not set');
      }
      let stripeInvoicePaymentSucceededEvent = {
        id: 'evt_1234567890',
        object: 'event',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_1234567890',
            object: 'invoice',
            amount_paid: 12,
            billing_reason: 'subscription_create',
            period_end: 1638465600,
            period_start: 1635873600,
            subscription: 'sub_1234567890',
            customer: 'cus_123',
            lines: {
              data: [
                {
                  amount: 12,
                  price: { product: 'prod_creator' },
                },
              ],
            },
          },
        },
      };

      let timestamp = Math.floor(Date.now() / 1000);
      let stripeInvoicePaymentSucceededPayload = JSON.stringify(
        stripeInvoicePaymentSucceededEvent,
      );
      let stripeInvoicePaymentSucceededSignature =
        Stripe.webhooks.generateTestHeaderString({
          payload: stripeInvoicePaymentSucceededPayload,
          secret,
          timestamp,
        });
      await request
        .post('/_stripe-webhook')
        .send(stripeInvoicePaymentSucceededPayload)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', stripeInvoicePaymentSucceededSignature);

      let subscriptions = await fetchSubscriptionsByUserId(dbAdapter, user.id);
      assert.strictEqual(subscriptions.length, 1);
      assert.strictEqual(subscriptions[0].status, 'active');
      assert.strictEqual(subscriptions[0].planId, creatorPlan.id);

      createSubscriptionStub.throws({
        message: 'Failed subscribing to free plan',
      });
      let fetchPriceListResponse = {
        object: 'list',
        data: [
          {
            id: 'price_1QMRCxH9rBd1yAHRD4BXhAHW',
            object: 'price',
            active: true,
            billing_scheme: 'per_unit',
            created: 1731921923,
            currency: 'usd',
            custom_unit_amount: null,
            livemode: false,
            lookup_key: null,
            metadata: {},
            nickname: null,
            product: 'prod_REv3E69DbAPv4K',
            recurring: {
              aggregate_usage: null,
              interval: 'month',
              interval_count: 1,
              meter: null,
              trial_period_days: null,
              usage_type: 'licensed',
            },
            tax_behavior: 'unspecified',
            tiers_mode: null,
            transform_quantity: null,
            type: 'recurring',
            unit_amount: 0,
            unit_amount_decimal: '0',
          },
        ],
        has_more: false,
        url: '/v1/prices',
      };
      fetchPriceListStub.resolves(fetchPriceListResponse);

      let stripeSubscriptionDeletedEvent = {
        id: 'evt_sub_deleted_1',
        object: 'event',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_1234567890',
            canceled_at: 2,
            cancellation_details: {
              reason: 'payment_failure',
            },
          },
        },
      };
      let stripeSubscriptionDeletedPayload = JSON.stringify(
        stripeSubscriptionDeletedEvent,
      );
      let stripeSubscriptionDeletedSignature =
        Stripe.webhooks.generateTestHeaderString({
          payload: stripeSubscriptionDeletedPayload,
          secret,
          timestamp,
        });
      await request
        .post('/_stripe-webhook')
        .send(stripeSubscriptionDeletedPayload)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', stripeSubscriptionDeletedSignature);

      subscriptions = await fetchSubscriptionsByUserId(dbAdapter, user.id);
      assert.strictEqual(subscriptions.length, 1);
      assert.strictEqual(subscriptions[0].status, 'expired');
      assert.strictEqual(subscriptions[0].planId, creatorPlan.id);

      // ensures the subscription info is null,
      // so the host can use that to redirect user to checkout free plan page
      let response = await request
        .get(`/_user`)
        .set('Accept', 'application/vnd.api+json')
        .set(
          'Authorization',
          `Bearer ${createJWT(testRealm, '@test_realm:localhost', [
            'read',
            'write',
          ])}`,
        );
      assert.strictEqual(response.status, 200, 'HTTP 200 status');
      let json = response.body;
      assert.deepEqual(
        json,
        {
          data: {
            type: 'user',
            id: user.id,
            attributes: {
              matrixUserId: user.matrixUserId,
              stripeCustomerId: user.stripeCustomerId,
              creditsAvailableInPlanAllowance: null,
              creditsIncludedInPlanAllowance: null,
              extraCreditsAvailableInBalance: null,
            },
            relationships: {
              subscription: null,
            },
          },
          included: null,
        },
        '/_user response is correct',
      );
    });

    test('sends billing notification on invoice payment succeeded event', async function (assert) {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      await insertUser(dbAdapter, userId!, 'cus_123');
      await insertPlan(dbAdapter, 'Free plan', 0, 100, 'prod_free');
      if (!secret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not set');
      }
      let event = {
        id: 'evt_1234567890',
        object: 'event',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_1234567890',
            object: 'invoice',
            amount_paid: 0, // free plan
            billing_reason: 'subscription_create',
            period_end: 1638465600,
            period_start: 1635873600,
            subscription: 'sub_1234567890',
            customer: 'cus_123',
            lines: {
              data: [
                {
                  amount: 0,
                  price: { product: 'prod_free' },
                },
              ],
            },
          },
        },
      };

      let payload = JSON.stringify(event);
      let timestamp = Math.floor(Date.now() / 1000);
      let signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret,
        timestamp,
      });

      await request
        .post('/_stripe-webhook')
        .send(payload)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', signature);
      waitForBillingNotification(assert, assert.async());
    });

    test('sends billing notification on checkout session completed event', async function (assert) {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      await insertUser(dbAdapter, userId!, 'cus_123');
      await insertPlan(dbAdapter, 'Free plan', 0, 100, 'prod_free');
      if (!secret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not set');
      }
      let event = {
        id: 'evt_1234567890',
        object: 'event',
        data: {
          object: {
            id: 'cs_test_1234567890',
            object: 'checkout.session',
            client_reference_id: encodeWebSafeBase64(userId),
            customer: 'cus_123',
            metadata: {},
          },
        },
        type: 'checkout.session.completed',
      };

      let payload = JSON.stringify(event);
      let timestamp = Math.floor(Date.now() / 1000);
      let signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret,
        timestamp,
      });

      await request
        .post('/_stripe-webhook')
        .send(payload)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', signature);
      waitForBillingNotification(assert, assert.async());
    });
  });
});

module('Realm server with realm mounted at the origin', function (hooks) {
  let testRealmServer: Server;

  let request: SuperTest<Test>;

  let dir: DirResult;

  let { virtualNetwork, loader } = createVirtualNetworkAndLoader();

  setupCardLogs(
    hooks,
    async () => await loader.import(`${baseRealm.url}card-api`),
  );

  setupBaseRealmServer(hooks, virtualNetwork, matrixURL);

  hooks.beforeEach(async function () {
    dir = dirSync();
  });

  setupDB(hooks, {
    beforeEach: async (dbAdapter, publisher, runner) => {
      let testRealmDir = join(dir.name, 'realm_server_3', 'test');
      ensureDirSync(testRealmDir);
      copySync(join(__dirname, 'cards'), testRealmDir);
      testRealmServer = (
        await runTestRealmServer({
          virtualNetwork: createVirtualNetwork(),
          testRealmDir,
          realmsRootPath: join(dir.name, 'realm_server_3'),
          realmURL: testRealmURL,
          dbAdapter,
          publisher,
          runner,
          matrixURL,
        })
      ).testRealmHttpServer;
      request = supertest(testRealmServer);
    },
    afterEach: async () => {
      await closeServer(testRealmServer);
    },
  });

  test('serves an origin realm directory GET request', async function (assert) {
    let response = await request
      .get('/')
      .set('Accept', 'application/vnd.api+json');

    assert.strictEqual(response.status, 200, 'HTTP 200 status');
    let json = response.body;
    for (let relationship of Object.values(json.data.relationships)) {
      delete (relationship as any).meta.lastModified;
    }
    assert.deepEqual(
      json,
      {
        data: {
          id: testRealmHref,
          type: 'directory',
          relationships: {
            '%F0%9F%98%80.gts': {
              links: {
                related: 'http://127.0.0.1:4444/%F0%9F%98%80.gts',
              },
              meta: {
                kind: 'file',
              },
            },
            'a.js': {
              links: {
                related: `${testRealmHref}a.js`,
              },
              meta: {
                kind: 'file',
              },
            },
            'b.js': {
              links: {
                related: `${testRealmHref}b.js`,
              },
              meta: {
                kind: 'file',
              },
            },
            'c.js': {
              links: {
                related: `${testRealmHref}c.js`,
              },
              meta: {
                kind: 'file',
              },
            },
            'code-ref-test.gts': {
              links: {
                related: `${testRealmHref}code-ref-test.gts`,
              },
              meta: {
                kind: 'file',
              },
            },
            'cycle-one.js': {
              links: {
                related: `${testRealmHref}cycle-one.js`,
              },
              meta: {
                kind: 'file',
              },
            },
            'cycle-two.js': {
              links: {
                related: `${testRealmHref}cycle-two.js`,
              },
              meta: {
                kind: 'file',
              },
            },
            'd.js': {
              links: {
                related: `${testRealmHref}d.js`,
              },
              meta: {
                kind: 'file',
              },
            },
            'deadlock/': {
              links: {
                related: `${testRealmHref}deadlock/`,
              },
              meta: {
                kind: 'directory',
              },
            },
            'dir/': {
              links: {
                related: `${testRealmHref}dir/`,
              },
              meta: {
                kind: 'directory',
              },
            },
            'e.js': {
              links: {
                related: `${testRealmHref}e.js`,
              },
              meta: {
                kind: 'file',
              },
            },
            'family_photo_card.gts': {
              links: {
                related: `${testRealmHref}family_photo_card.gts`,
              },
              meta: {
                kind: 'file',
              },
            },
            'FamilyPhotoCard/': {
              links: {
                related: `${testRealmHref}FamilyPhotoCard/`,
              },
              meta: {
                kind: 'directory',
              },
            },
            'friend.gts': {
              links: {
                related: `${testRealmHref}friend.gts`,
              },
              meta: {
                kind: 'file',
              },
            },
            'hassan.json': {
              links: {
                related: `${testRealmHref}hassan.json`,
              },
              meta: {
                kind: 'file',
              },
            },
            'home.gts': {
              links: {
                related: `${testRealmHref}home.gts`,
              },
              meta: {
                kind: 'file',
              },
            },
            'index.json': {
              links: {
                related: `${testRealmHref}index.json`,
              },
              meta: {
                kind: 'file',
              },
            },
            'jade.json': {
              links: {
                related: `${testRealmHref}jade.json`,
              },
              meta: {
                kind: 'file',
              },
            },
            'missing-link.json': {
              links: {
                related: `${testRealmHref}missing-link.json`,
              },
              meta: {
                kind: 'file',
              },
            },
            'person-1.json': {
              links: {
                related: `${testRealmHref}person-1.json`,
              },
              meta: {
                kind: 'file',
              },
            },
            'person-2.json': {
              links: {
                related: `${testRealmHref}person-2.json`,
              },
              meta: {
                kind: 'file',
              },
            },
            'person-with-error.gts': {
              links: {
                related: `${testRealmHref}person-with-error.gts`,
              },
              meta: {
                kind: 'file',
              },
            },
            'person.gts': {
              links: {
                related: `${testRealmHref}person.gts`,
              },
              meta: {
                kind: 'file',
              },
            },
            'person.json': {
              links: {
                related: `${testRealmHref}person.json`,
              },
              meta: {
                kind: 'file',
              },
            },
            'PersonCard/': {
              links: {
                related: `${testRealmHref}PersonCard/`,
              },
              meta: {
                kind: 'directory',
              },
            },
            'query-test-cards.gts': {
              links: {
                related: `${testRealmHref}query-test-cards.gts`,
              },
              meta: {
                kind: 'file',
              },
            },
            'unused-card.gts': {
              links: {
                related: `${testRealmHref}unused-card.gts`,
              },
              meta: {
                kind: 'file',
              },
            },
          },
        },
      },
      'the directory response is correct',
    );
  });
});

module('Realm server serving multiple realms', function (hooks) {
  let testRealmServer: Server;
  let request: SuperTest<Test>;
  let dir: DirResult;
  let base: Realm;
  let testRealm: Realm;

  let { virtualNetwork, loader } = createVirtualNetworkAndLoader();
  const basePath = resolve(join(__dirname, '..', '..', 'base'));

  hooks.beforeEach(async function () {
    dir = dirSync();
    ensureDirSync(join(dir.name, 'demo'));
    copySync(join(__dirname, 'cards'), join(dir.name, 'demo'));
  });

  setupDB(hooks, {
    beforeEach: async (dbAdapter, publisher, runner) => {
      let localBaseRealmURL = new URL('http://127.0.0.1:4446/base/');
      virtualNetwork.addURLMapping(new URL(baseRealm.url), localBaseRealmURL);

      base = await createRealm({
        withWorker: true,
        dir: basePath,
        realmURL: baseRealm.url,
        virtualNetwork,
        publisher,
        runner,
        dbAdapter,
        deferStartUp: true,
      });
      virtualNetwork.mount(base.handle);

      testRealm = await createRealm({
        withWorker: true,
        dir: join(dir.name, 'demo'),
        virtualNetwork,
        realmURL: 'http://127.0.0.1:4446/demo/',
        publisher,
        runner,
        dbAdapter,
        deferStartUp: true,
      });
      virtualNetwork.mount(testRealm.handle);

      let matrixClient = new MatrixClient({
        matrixURL: realmServerTestMatrix.url,
        username: realmServerTestMatrix.username,
        seed: secretSeed,
      });
      let getIndexHTML = (await getFastbootState()).getIndexHTML;
      testRealmServer = new RealmServer({
        realms: [base, testRealm],
        virtualNetwork,
        matrixClient,
        secretSeed,
        matrixRegistrationSecret,
        realmsRootPath: dir.name,
        dbAdapter,
        queue: publisher,
        getIndexHTML,
        seedPath,
        serverURL: new URL('http://127.0.0.1:4446'),
        assetsURL: new URL(`http://example.com/notional-assets-host/`),
      }).listen(parseInt(localBaseRealmURL.port));
      await base.start();
      await testRealm.start();

      request = supertest(testRealmServer);
    },
    afterEach: async () => {
      await closeServer(testRealmServer);
    },
  });

  setupCardLogs(
    hooks,
    async () => await loader.import(`${baseRealm.url}card-api`),
  );

  test(`Can perform full indexing multiple times on a server that runs multiple realms`, async function (assert) {
    {
      let response = await request
        .get('/demo/person-1')
        .set('Accept', 'application/vnd.card+json');
      assert.strictEqual(response.status, 200, 'HTTP 200 status');
    }

    await base.reindex();
    await testRealm.reindex();

    {
      let response = await request
        .get('/demo/person-1')
        .set('Accept', 'application/vnd.card+json');
      assert.strictEqual(response.status, 200, 'HTTP 200 status');
    }

    await base.reindex();
    await testRealm.reindex();

    {
      let response = await request
        .get('/demo/person-1')
        .set('Accept', 'application/vnd.card+json');
      assert.strictEqual(response.status, 200, 'HTTP 200 status');
    }
  });
});

module('Realm Server serving from a subdirectory', function (hooks) {
  let testRealmServer: Server;

  let request: SuperTest<Test>;

  let dir: DirResult;

  let { virtualNetwork, loader } = createVirtualNetworkAndLoader();

  setupCardLogs(
    hooks,
    async () => await loader.import(`${baseRealm.url}card-api`),
  );

  setupBaseRealmServer(hooks, virtualNetwork, matrixURL);

  hooks.beforeEach(async function () {
    dir = dirSync();
  });

  setupDB(hooks, {
    beforeEach: async (dbAdapter, publisher, runner) => {
      dir = dirSync();
      let testRealmDir = join(dir.name, 'realm_server_4', 'test');
      ensureDirSync(testRealmDir);
      copySync(join(__dirname, 'cards'), testRealmDir);
      testRealmServer = (
        await runTestRealmServer({
          virtualNetwork: createVirtualNetwork(),
          testRealmDir,
          realmsRootPath: join(dir.name, 'realm_server_4'),
          realmURL: new URL('http://127.0.0.1:4446/demo/'),
          dbAdapter,
          publisher,
          runner,
          matrixURL,
        })
      ).testRealmHttpServer;
      request = supertest(testRealmServer);
    },
    afterEach: async () => {
      await closeServer(testRealmServer);
    },
  });

  test('serves a subdirectory GET request that results in redirect', async function (assert) {
    let response = await request.get('/demo');

    assert.strictEqual(response.status, 302, 'HTTP 302 status');
    assert.strictEqual(
      response.headers['location'],
      'http://127.0.0.1:4446/demo/',
    );
  });

  test('redirection keeps query params intact', async function (assert) {
    let response = await request.get(
      '/demo?operatorModeEnabled=true&operatorModeState=%7B%22stacks%22%3A%5B%7B%22items%22%3A%5B%7B%22card%22%3A%7B%22id%22%3A%22http%3A%2F%2Flocalhost%3A4204%2Findex%22%7D%2C%22format%22%3A%22isolated%22%7D%5D%7D%5D%7D',
    );

    assert.strictEqual(response.status, 302, 'HTTP 302 status');
    assert.strictEqual(
      response.headers['location'],
      'http://127.0.0.1:4446/demo/?operatorModeEnabled=true&operatorModeState=%7B%22stacks%22%3A%5B%7B%22items%22%3A%5B%7B%22card%22%3A%7B%22id%22%3A%22http%3A%2F%2Flocalhost%3A4204%2Findex%22%7D%2C%22format%22%3A%22isolated%22%7D%5D%7D%5D%7D',
    );
  });
});

module('Realm server authentication', function (hooks) {
  let testRealmServer: Server;

  let request: SuperTest<Test>;

  let dir: DirResult;

  let { virtualNetwork, loader } = createVirtualNetworkAndLoader();

  setupCardLogs(
    hooks,
    async () => await loader.import(`${baseRealm.url}card-api`),
  );

  setupBaseRealmServer(hooks, virtualNetwork, matrixURL);

  hooks.beforeEach(async function () {
    dir = dirSync();
  });

  setupDB(hooks, {
    beforeEach: async (dbAdapter, publisher, runner) => {
      let testRealmDir = join(dir.name, 'realm_server_5', 'test');
      ensureDirSync(testRealmDir);
      copySync(join(__dirname, 'cards'), testRealmDir);
      testRealmServer = (
        await runTestRealmServer({
          virtualNetwork: createVirtualNetwork(),
          testRealmDir,
          realmsRootPath: join(dir.name, 'realm_server_5'),
          realmURL: testRealmURL,
          dbAdapter,
          publisher,
          runner,
          matrixURL,
        })
      ).testRealmHttpServer;
      request = supertest(testRealmServer);
    },
    afterEach: async () => {
      await closeServer(testRealmServer);
    },
  });

  test('authenticates user', async function (assert) {
    let matrixClient = new MatrixClient({
      matrixURL: realmServerTestMatrix.url,
      // it's a little awkward that we are hijacking a realm user to pretend to
      // act like a normal user, but that's what's happening here
      username: 'test_realm',
      seed: secretSeed,
    });
    await matrixClient.login();
    let userId = matrixClient.getUserId();

    let response = await request
      .post('/_server-session')
      .send(JSON.stringify({ user: userId }))
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json');

    assert.strictEqual(response.status, 401, 'HTTP 401 status');
    let json = response.body;

    let { joined_rooms: rooms } = await matrixClient.getJoinedRooms();

    if (!rooms.includes(json.room)) {
      await matrixClient.joinRoom(json.room);
    }

    await matrixClient.sendEvent(json.room, 'm.room.message', {
      body: `auth-response: ${json.challenge}`,
      msgtype: 'm.text',
    });

    response = await request
      .post('/_server-session')
      .send(JSON.stringify({ user: userId, challenge: json.challenge }))
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json');
    assert.strictEqual(response.status, 201, 'HTTP 201 status');
    let token = response.headers['authorization'];
    let decoded = jwt.verify(token, secretSeed) as RealmServerTokenClaim;
    assert.strictEqual(decoded.user, userId);
    assert.notStrictEqual(
      decoded.sessionRoom,
      undefined,
      'sessionRoom should be defined',
    );
  });
});

function assertScopedCssUrlsContain(
  assert: Assert,
  scopedCssUrls: string[],
  moduleUrls: string[],
) {
  moduleUrls.forEach((url) => {
    let pattern = new RegExp(`^${url}\\.[^.]+\\.glimmer-scoped\\.css$`);

    assert.true(
      scopedCssUrls.some((scopedCssUrl) => pattern.test(scopedCssUrl)),
      `css url for ${url} is in the deps`,
    );
  });
}

// These modules have CSS that CardDef consumes, so we expect to see them in all relationships of a prerendered card
let cardDefModuleDependencies = [
  'https://cardstack.com/base/default-templates/embedded.gts',
  'https://cardstack.com/base/default-templates/isolated-and-edit.gts',
  'https://cardstack.com/base/default-templates/field-edit.gts',
  'https://cardstack.com/base/field-component.gts',
  'https://cardstack.com/base/contains-many-component.gts',
  'https://cardstack.com/base/links-to-editor.gts',
  'https://cardstack.com/base/links-to-many-component.gts',
];
