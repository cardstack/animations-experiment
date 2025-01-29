import { module } from 'qunit';

import { baseRealm } from '@cardstack/runtime-common';

import {
  setupLocalIndexing,
  setupServerSentEvents,
  setupAcceptanceTestRealm,
  testRealmURL,
  lookupLoaderService,
  setupUserSubscription,
} from '../helpers';
import { setupMockMatrix } from '../helpers/mock-matrix';
import { setupApplicationTest } from '../helpers/setup';

let matrixRoomId: string;
module('Acceptance | permissioned realm tests', function (hooks) {
  setupApplicationTest(hooks);
  setupLocalIndexing(hooks);
  setupServerSentEvents(hooks);
  let { createAndJoinRoom } = setupMockMatrix(hooks, {
    loggedInAs: '@testuser:staging',
    activeRealms: [testRealmURL],
  });

  hooks.beforeEach(async function () {
    matrixRoomId = createAndJoinRoom('@testuser:staging', 'room-test');
    setupUserSubscription(matrixRoomId);

    let loader = lookupLoaderService().loader;
    let { field, contains, CardDef, Component } = await loader.import<
      typeof import('https://cardstack.com/base/card-api')
    >(`${baseRealm.url}card-api`);
    let { default: StringField } = await loader.import<
      typeof import('https://cardstack.com/base/string')
    >(`${baseRealm.url}string`);
    let { BoxelSpec } = await loader.import<
      typeof import('https://cardstack.com/base/boxel-spec')
    >(`${baseRealm.url}boxel-spec`);

    class Index extends CardDef {
      static isolated = class Isolated extends Component<typeof this> {
        <template>
          <div data-test-index-card>
            Hello, world!
          </div>
        </template>
      };
    }

    class Person extends CardDef {
      @field firstName = contains(StringField);
      @field lastName = contains(StringField);
      @field title = contains(StringField, {
        computeVia: function (this: Person) {
          return [this.firstName, this.lastName].filter(Boolean).join(' ');
        },
      });
      static isolated = class Isolated extends Component<typeof this> {
        <template>
          <div data-test-person>
            <p>First name: <@fields.firstName /></p>
            <p>Last name: <@fields.lastName /></p>
            <p>Title: <@fields.title /></p>
          </div>
          <style scoped>
            div {
              color: green;
              content: '';
            }
          </style>
        </template>
      };
    }

    await setupAcceptanceTestRealm({
      contents: {
        'index.gts': { Index },
        'person.gts': { Person },
        'person-entry.json': new BoxelSpec({
          name: 'Person',
          description: 'Boxel spec',
          specType: 'card',
          ref: {
            module: `./person`,
            name: 'Person',
          },
        }),
        'index.json': new Index(),
        'Person/1.json': new Person({
          firstName: 'Hassan',
          lastName: 'Abdel-Rahman',
        }),
      },
      permissions: { users: ['read', 'write'] },
    });
  });
});
