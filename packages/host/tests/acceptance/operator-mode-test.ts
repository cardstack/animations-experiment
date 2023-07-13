import { module, test } from 'qunit';
import { visit, currentURL, click, triggerEvent } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { Loader } from '@cardstack/runtime-common/loader';
import { baseRealm } from '@cardstack/runtime-common';
import {
  TestRealm,
  TestRealmAdapter,
  setupLocalIndexing,
  setupMockMessageService,
  testRealmURL,
} from '../helpers';
import { Realm } from '@cardstack/runtime-common/realm';
import { shimExternals } from '@cardstack/host/lib/externals';
import type LoaderService from '@cardstack/host/services/loader-service';
import percySnapshot from '@percy/ember';
import OperatorModeStateService from '@cardstack/host/services/operator-mode-state-service';

module('Acceptance | operator mode tests', function (hooks) {
  let realm: Realm;
  let adapter: TestRealmAdapter;

  setupApplicationTest(hooks);
  setupLocalIndexing(hooks);
  setupMockMessageService(hooks);

  hooks.beforeEach(async function () {
    Loader.addURLMapping(
      new URL(baseRealm.url),
      new URL('http://localhost:4201/base/')
    );
    shimExternals();
    adapter = new TestRealmAdapter({
      'pet.gts': `
        import { contains, field, Component, Card } from "https://cardstack.com/base/card-api";
        import StringCard from "https://cardstack.com/base/string";

        export class Pet extends Card {
          static displayName = 'Pet';
          @field name = contains(StringCard);
          @field title = contains(StringCard, {
            computeVia: function (this: Pet) {
              return this.name;
            },
          });
          static embedded = class Embedded extends Component<typeof this> {
            <template>
              <h3 data-test-pet={{@model.name}}>
                <@fields.name/>
              </h3>
            </template>
          }
        }
      `,
      'address.gts': `
        import { contains, field, Component, Card } from "https://cardstack.com/base/card-api";
        import StringCard from "https://cardstack.com/base/string";
        import { FieldContainer } from '@cardstack/boxel-ui';

        export class Address extends Card {
          static displayName = 'Address';
          @field city = contains(StringCard);
          @field country = contains(StringCard);
          static embedded = class Embedded extends Component<typeof this> {
            <template>
              <h3 data-test-city={{@model.city}}>
                <@fields.city/>
              </h3>
              <h3 data-test-country={{@model.country}}>
                <@fields.country/>
              </h3>
            </template>
          }

          static edit = class Edit extends Component<typeof this> {
            <template>
              <FieldContainer @label='city' @tag='label' data-test-boxel-input-city>
                <@fields.city />
              </FieldContainer>
              <FieldContainer @label='country' @tag='label' data-test-boxel-input-country>
                <@fields.country />
              </FieldContainer>
            </template>
          };
        }
      `,
      'person.gts': `
        import { contains, linksTo, field, Component, Card, linksToMany } from "https://cardstack.com/base/card-api";
        import StringCard from "https://cardstack.com/base/string";
        import { Pet } from "./pet";
        import { Address } from "./address";

        export class Person extends Card {
          static displayName = 'Person';
          @field firstName = contains(StringCard);
          @field pet = linksTo(Pet);
          @field friends = linksToMany(Pet);
          @field firstLetterOfTheName = contains(StringCard, {
            computeVia: function (this: Chain) {
              return this.firstName[0];
            },
          });
          @field title = contains(StringCard, {
            computeVia: function (this: Person) {
              return this.firstName;
            },
          });
          @field address = contains(Address);
          static isolated = class Isolated extends Component<typeof this> {
            <template>
              <h2 data-test-person={{@model.firstName}}>
                <@fields.firstName/>
              </h2>
              <p data-test-first-letter-of-the-name={{@model.firstLetterOfTheName}}>
                <@fields.firstLetterOfTheName/>
              </p>
              Pet: <@fields.pet/>
              Friends: <@fields.friends/>
              Address: <@fields.address/>
            </template>
          }
        }
      `,
      'Pet/mango.json': {
        data: {
          type: 'card',
          id: `${testRealmURL}Pet/mango`,
          attributes: {
            name: 'Mango',
          },
          meta: {
            adoptsFrom: {
              module: `${testRealmURL}pet`,
              name: 'Pet',
            },
          },
        },
      },

      'Person/fadhlan.json': {
        data: {
          type: 'card',
          id: `${testRealmURL}Person/fadhlan`,
          attributes: {
            firstName: 'Fadhlan',
            address: {
              city: 'Bandung',
              country: 'Indonesia',
            },
          },
          relationships: {
            pet: {
              links: {
                self: `${testRealmURL}Pet/mango`,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: `${testRealmURL}person`,
              name: 'Person',
            },
          },
        },
      },
      'grid.json': {
        data: {
          type: 'card',
          attributes: {},
          meta: {
            adoptsFrom: {
              module: 'https://cardstack.com/base/cards-grid',
              name: 'CardsGrid',
            },
          },
        },
      },
      'index.json': {
        data: {
          type: 'card',
          attributes: {},
          meta: {
            adoptsFrom: {
              module: 'https://cardstack.com/base/cards-grid',
              name: 'CardsGrid',
            },
          },
        },
      },
    });

    realm = await TestRealm.createWithAdapter(adapter, this.owner, {
      isAcceptanceTest: true,
    });

    let loader = (this.owner.lookup('service:loader-service') as LoaderService)
      .loader;
    loader.registerURLHandler(new URL(realm.url), realm.handle.bind(realm));
    await realm.ready;
  });

  module('1 stack', function () {
    test('visiting index card and entering operator mode', async function (assert) {
      await visit('/');

      assert.strictEqual(currentURL(), '/');

      // Enter operator mode
      await triggerEvent(document.body, 'keydown', {
        code: 'Key.',
        key: '.',
        ctrlKey: true,
      });

      assert.dom('[data-test-operator-mode-stack]').exists();
      assert.dom('[data-test-stack-card-index="0"]').exists(); // Index card opens in the stack

      await percySnapshot(assert);

      // In the URL, operatorModeEnabled is set to true and operatorModeState is set to the current stack
      assert.strictEqual(
        currentURL(),
        `/?operatorModeEnabled=true&operatorModeState=${encodeURIComponent(
          JSON.stringify({
            stacks: [
              {
                items: [
                  {
                    card: { id: 'http://test-realm/test/index' },
                    format: 'isolated',
                  },
                ],
              },
            ],
          })
        )}`
      );
    });

    test('restoring the stack from query param', async function (assert) {
      let operatorModeStateParam = JSON.stringify({
        stacks: [
          {
            items: [
              {
                card: { id: 'http://test-realm/test/Person/fadhlan' },
                format: 'isolated',
              },
              {
                card: { id: 'http://test-realm/test/Pet/mango' },
                format: 'isolated',
              },
            ],
          },
        ],
      });

      await visit(
        `/?operatorModeEnabled=true&operatorModeState=${encodeURIComponent(
          operatorModeStateParam
        )}`
      );

      await percySnapshot(assert);

      assert
        .dom('[data-test-stack-card-index="0"] [data-test-boxel-header-title]')
        .includesText('Person');

      assert
        .dom('[data-test-stack-card-index="1"] [data-test-boxel-header-title]')
        .includesText('Pet');

      // Remove the dog from the stack
      await click('[data-test-stack-card-index="1"] [data-test-close-button]');

      // The stack should be updated in the URL
      assert.strictEqual(
        currentURL(),
        `/?operatorModeEnabled=true&operatorModeState=${encodeURIComponent(
          JSON.stringify({
            stacks: [
              {
                items: [
                  {
                    card: { id: 'http://test-realm/test/Person/fadhlan' },
                    format: 'isolated',
                  },
                ],
              },
            ],
          })
        )}`
      );

      // Add the dog back to the stack (via overlayed linked card button)
      await click('[data-test-overlay-button]');

      // The stack should be reflected in the URL
      assert.strictEqual(
        currentURL(),
        `/?operatorModeEnabled=true&operatorModeState=${encodeURIComponent(
          JSON.stringify({
            stacks: [
              {
                items: [
                  {
                    card: { id: 'http://test-realm/test/Person/fadhlan' },
                    format: 'isolated',
                  },
                  {
                    card: { id: 'http://test-realm/test/Pet/mango' },
                    format: 'isolated',
                  },
                ],
              },
            ],
          })
        )}`
      );

      // Click Edit on the top card
      await click('[data-test-stack-card-index="1"] [data-test-edit-button]');

      // The edit format should be reflected in the URL
      assert.strictEqual(
        currentURL(),
        `/?operatorModeEnabled=true&operatorModeState=${encodeURIComponent(
          JSON.stringify({
            stacks: [
              {
                items: [
                  {
                    card: { id: 'http://test-realm/test/Person/fadhlan' },
                    format: 'isolated',
                  },
                  {
                    card: { id: 'http://test-realm/test/Pet/mango' },
                    format: 'edit',
                  },
                ],
              },
            ],
          })
        )}`
      );
    });

    test('restoring the stack from query param when card is in edit format', async function (assert) {
      let operatorModeStateParam = JSON.stringify({
        stacks: [
          {
            items: [
              {
                card: { id: 'http://test-realm/test/Person/fadhlan' },
                format: 'edit',
              },
            ],
          },
        ],
      });

      await visit(
        `/?operatorModeEnabled=true&operatorModeState=${encodeURIComponent(
          operatorModeStateParam
        )}`
      );

      await percySnapshot(assert);

      assert.dom('[data-test-field="firstName"] input').exists(); // Existence of an input field means it is in edit mode
      assert.dom('[data-test-save-button]').exists(); // Existence of save button means it is in edit mode
    });

    test('click left or right add card button will open the search panel and then click on a recent card will open a new stack on the left or right', async function (assert) {
      let operatorModeStateParam = JSON.stringify({
        stacks: [
          {
            items: [
              {
                card: { id: 'http://test-realm/test/Person/fadhlan' },
                format: 'isolated',
              },
              {
                card: { id: 'http://test-realm/test/Pet/mango' },
                format: 'edit',
              },
            ],
          },
        ],
      });

      await visit(
        `/?operatorModeEnabled=true&operatorModeState=${encodeURIComponent(
          operatorModeStateParam
        )}`
      );

      let operatorModeStateService = this.owner.lookup(
        'service:operator-mode-state-service'
      ) as OperatorModeStateService;

      // @ts-ignore Property '#private' is missing in type 'Card[]' but required in type 'TrackedArray<Card>'.glint(2741) - don't care about this error here, just stubbing
      operatorModeStateService.recentCards =
        operatorModeStateService.state.stacks[0].items.map((item) => item.card);

      assert.dom('[data-test-operator-mode-stack]').exists({ count: 1 });
      assert.dom('[data-test-add-card-left-stack]').exists();
      assert.dom('[data-test-add-card-right-stack]').exists();
      assert.dom('[data-test-search-sheet]').doesNotHaveClass('prompt'); // Search closed

      // Add a card to the left stack
      await click('[data-test-add-card-left-stack]');

      assert.dom('[data-test-search-sheet]').hasClass('prompt'); // Search opened

      await click(
        '[data-test-search-result="http://test-realm/test/Pet/mango"]'
      );

      assert.dom('[data-test-search-sheet]').doesNotHaveClass('prompt'); // Search closed

      // There are now 2 stacks
      assert.dom('[data-test-operator-mode-stack]').exists({ count: 2 });
      assert.dom('[data-test-operator-mode-stack="0"]').includesText('Mango'); // Mango goes on the left stack
      assert.dom('[data-test-operator-mode-stack="1"]').includesText('Fadhlan');

      // Buttons to add a neighbor stack are gone
      assert.dom('[data-test-add-card-left-stack]').doesNotExist();
      assert.dom('[data-test-add-card-right-stack]').doesNotExist();

      // Close the only card in the 2nd stack
      await click(
        '[data-test-operator-mode-stack="1"] [data-test-close-button]'
      );

      // There is now only 1 stack and the buttons to add a neighbor stack are back
      assert.dom('[data-test-operator-mode-stack]').exists({ count: 1 });
      assert.dom('[data-test-add-card-left-stack]').exists();
      assert.dom('[data-test-add-card-right-stack]').exists();

      // Add a card to the right stack
      await click('[data-test-add-card-left-stack]');

      assert.dom('[data-test-search-sheet]').hasClass('prompt'); // Search opened

      await click(
        '[data-test-search-result="http://test-realm/test/Person/fadhlan"]'
      );

      assert.dom('[data-test-search-sheet]').doesNotHaveClass('prompt'); // Search closed

      // There are now 2 stacks
      assert.dom('[data-test-operator-mode-stack]').exists({ count: 2 });
      assert.dom('[data-test-operator-mode-stack="0"]').includesText('Fadhlan');
      assert.dom('[data-test-operator-mode-stack="1"]').includesText('Mango'); // Fadhlan goes on the right stack

      // Buttons to add a neighbor stack are gone
      assert.dom('[data-test-add-card-left-stack]').doesNotExist();
      assert.dom('[data-test-add-card-right-stack]').doesNotExist();
    });
  });

  module('2 stacks', function () {
    test('restoring the stacks from query param', async function (assert) {
      let operatorModeStateParam = JSON.stringify({
        stacks: [
          {
            items: [
              {
                card: { id: 'http://test-realm/test/Person/fadhlan' },
                format: 'isolated',
              },
            ],
          },
          {
            items: [
              {
                card: { id: 'http://test-realm/test/Pet/mango' },
                format: 'isolated',
              },
            ],
          },
        ],
      });

      await visit(
        `/?operatorModeEnabled=true&operatorModeState=${encodeURIComponent(
          operatorModeStateParam
        )}`
      );

      assert.dom('[data-test-operator-mode-stack]').exists({ count: 2 });
      assert.dom('[data-test-operator-mode-stack="0"]').includesText('Fadhlan');
      assert.dom('[data-test-operator-mode-stack="1"]').includesText('Mango');

      // Close the card in the 2nd stack
      await click(
        '[data-test-operator-mode-stack="1"] [data-test-close-button]'
      );
      assert.dom('[data-test-operator-mode-stack="0"]').exists();

      // 2nd stack is removed, 1st stack remains
      assert.dom('[data-test-operator-mode-stack="1"]').doesNotExist();
      assert.dom('[data-test-operator-mode-stack="0"]').includesText('Fadhlan');

      // The stack should be updated in the URL
      assert.strictEqual(
        currentURL(),
        `/?operatorModeEnabled=true&operatorModeState=${encodeURIComponent(
          JSON.stringify({
            stacks: [
              {
                items: [
                  {
                    card: { id: 'http://test-realm/test/Person/fadhlan' },
                    format: 'isolated',
                  },
                ],
              },
            ],
          })
        )}`
      );

      // Close the last card in the last stack that is left - should get the empty state
      await click(
        '[data-test-operator-mode-stack="0"] [data-test-close-button]'
      );

      assert.dom('.no-cards').includesText('Add a card to get started');
    });
  });
});
