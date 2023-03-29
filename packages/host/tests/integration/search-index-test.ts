import { module, test, skip } from 'qunit';
import {
  TestRealm,
  TestRealmAdapter,
  testRealmURL,
  cleanWhiteSpace,
  setupCardLogs,
  setupMockLocalRealm,
  type CardDocFiles,
} from '../helpers';
import { RealmPaths } from '@cardstack/runtime-common/paths';
import { setupRenderingTest } from 'ember-qunit';
import { SearchIndex } from '@cardstack/runtime-common/search-index';
import {
  baseRealm,
  baseCardRef,
  type CardRef,
  type LooseSingleCardDocument,
} from '@cardstack/runtime-common';
import { Loader } from '@cardstack/runtime-common/loader';
import { shimExternals } from '@cardstack/host/lib/externals';

const paths = new RealmPaths(testRealmURL);
const testModuleRealm = 'http://localhost:4202/test/';

module('Integration | search-index', function (hooks) {
  setupRenderingTest(hooks);
  setupMockLocalRealm(hooks);
  setupCardLogs(
    hooks,
    async () => await Loader.import(`${baseRealm.url}card-api`)
  );

  hooks.beforeEach(async function () {
    Loader.destroy();
    shimExternals();
    Loader.addURLMapping(
      new URL(baseRealm.url),
      new URL('http://localhost:4201/base/')
    );
  });

  test('full indexing discovers card instances', async function (assert) {
    let adapter = new TestRealmAdapter({
      'empty.json': {
        data: {
          meta: {
            adoptsFrom: {
              module: 'https://cardstack.com/base/card-api',
              name: 'Card',
            },
          },
        },
      },
    });
    let realm = await TestRealm.createWithAdapter(adapter, this.owner);
    await realm.ready;
    let indexer = realm.searchIndex;
    let { data: cards } = await indexer.search({});
    assert.deepEqual(cards, [
      {
        id: `${testRealmURL}empty`,
        type: 'card',
        meta: {
          adoptsFrom: {
            module: 'https://cardstack.com/base/card-api',
            name: 'Card',
          },
          lastModified: adapter.lastModified.get(`${testRealmURL}empty.json`),
        },
        links: {
          self: `${testRealmURL}empty`,
        },
      },
    ]);
  });

  test('can recover from indexing a card with a broken link', async function (assert) {
    let adapter = new TestRealmAdapter({
      'Pet/mango.json': {
        data: {
          id: `${testRealmURL}Pet/mango`,
          attributes: {
            firstName: 'Mango',
          },
          relationships: {
            owner: {
              links: {
                self: `${testRealmURL}Person/owner`,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/pet',
              name: 'Pet',
            },
          },
        },
      },
    });
    let realm = await TestRealm.createWithAdapter(adapter, this.owner);
    await realm.ready;
    let indexer = realm.searchIndex;
    {
      let mango = await indexer.card(new URL(`${testRealmURL}Pet/mango`));
      if (mango?.type === 'error') {
        assert.deepEqual(
          mango.error.detail,
          `missing file ${testRealmURL}Person/owner.json`
        );
        assert.deepEqual(mango.error.deps, [
          'http://localhost:4202/test/pet',
          `${testRealmURL}Person/owner.json`,
        ]);
      } else {
        assert.ok(false, `expected search entry to be an error doc`);
      }
    }
    await realm.write(
      'Person/owner.json',
      JSON.stringify({
        data: {
          id: `${testRealmURL}Person/owner`,
          attributes: {
            firstName: 'Hassan',
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/person',
              name: 'Person',
            },
          },
        },
      } as LooseSingleCardDocument)
    );
    {
      let mango = await indexer.card(new URL(`${testRealmURL}Pet/mango`));
      if (mango?.type === 'doc') {
        assert.deepEqual(mango.doc.data, {
          id: `${testRealmURL}Pet/mango`,
          type: 'card',
          links: {
            self: `${testRealmURL}Pet/mango`,
          },
          attributes: {
            firstName: 'Mango',
          },
          relationships: {
            owner: {
              links: {
                self: `${testRealmURL}Person/owner`,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/pet',
              name: 'Pet',
            },
            lastModified: adapter.lastModified.get(
              `${testRealmURL}Pet/mango.json`
            ),
          },
        });
      } else {
        assert.ok(false, `search entry was an error: ${mango?.error.detail}`);
      }
    }
  });

  test('can index card with linkTo field', async function (assert) {
    let adapter = new TestRealmAdapter({
      'Person/owner.json': {
        data: {
          id: `${testRealmURL}Person/owner`,
          attributes: {
            firstName: 'Hassan',
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/person',
              name: 'Person',
            },
          },
        },
      },
      'Pet/mango.json': {
        data: {
          id: `${testRealmURL}Pet/mango`,
          attributes: {
            firstName: 'Mango',
          },
          relationships: {
            owner: {
              links: {
                self: `${testRealmURL}Person/owner`,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/pet',
              name: 'Pet',
            },
          },
        },
      },
    });
    let realm = await TestRealm.createWithAdapter(adapter, this.owner);
    await realm.ready;
    let indexer = realm.searchIndex;
    let mango = await indexer.card(new URL(`${testRealmURL}Pet/mango`));
    if (mango?.type === 'doc') {
      assert.deepEqual(mango.doc.data, {
        id: `${testRealmURL}Pet/mango`,
        type: 'card',
        links: {
          self: `${testRealmURL}Pet/mango`,
        },
        attributes: {
          firstName: 'Mango',
        },
        relationships: {
          owner: {
            links: {
              self: `${testRealmURL}Person/owner`,
            },
          },
        },
        meta: {
          adoptsFrom: {
            module: 'http://localhost:4202/test/pet',
            name: 'Pet',
          },
          lastModified: adapter.lastModified.get(
            `${testRealmURL}Pet/mango.json`
          ),
        },
      });
    } else {
      assert.ok(false, `search entry was an error: ${mango?.error.detail}`);
    }
  });

  test('can index card with a relative linkTo field', async function (assert) {
    let adapter = new TestRealmAdapter({
      'Person/owner.json': {
        data: {
          id: `${testRealmURL}Person/owner`,
          attributes: {
            firstName: 'Hassan',
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/person',
              name: 'Person',
            },
          },
        },
      },
      'Pet/mango.json': {
        data: {
          id: `${testRealmURL}Pet/mango`,
          attributes: {
            firstName: 'Mango',
          },
          relationships: {
            owner: {
              links: {
                self: `../Person/owner`,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/pet',
              name: 'Pet',
            },
          },
        },
      },
    });
    let realm = await TestRealm.createWithAdapter(adapter, this.owner);
    await realm.ready;
    let indexer = realm.searchIndex;
    let mango = await indexer.card(new URL(`${testRealmURL}Pet/mango`));
    if (mango?.type === 'doc') {
      assert.deepEqual(mango.doc.data, {
        id: `${testRealmURL}Pet/mango`,
        type: 'card',
        links: {
          self: `${testRealmURL}Pet/mango`,
        },
        attributes: {
          firstName: 'Mango',
        },
        relationships: {
          owner: {
            links: {
              self: `${testRealmURL}Person/owner`,
            },
          },
        },
        meta: {
          adoptsFrom: {
            module: 'http://localhost:4202/test/pet',
            name: 'Pet',
          },
          lastModified: adapter.lastModified.get(
            `${testRealmURL}Pet/mango.json`
          ),
        },
      });
    } else {
      assert.ok(false, `search entry was an error: ${mango?.error.detail}`);
    }
  });

  test('can index a card with relative card-ref fields', async function (assert) {
    let adapter = new TestRealmAdapter({
      'person.gts': `
        import { contains, field, Card, Component } from "https://cardstack.com/base/card-api";
        import StringCard from "https://cardstack.com/base/string";

        export class Person extends Card {
          @field firstName = contains(StringCard);
        }
      `,
      'person-catalog-entry.json': {
        data: {
          attributes: {
            title: 'Person Card',
            description: 'Catalog entry for Person card',
            ref: {
              module: './person',
              name: 'Person',
            },
            demo: {
              firstName: 'Mango',
            },
          },
          meta: {
            fields: {
              demo: {
                adoptsFrom: {
                  module: './person',
                  name: 'Person',
                },
              },
            },
            adoptsFrom: {
              module: 'https://cardstack.com/base/catalog-entry',
              name: 'CatalogEntry',
            },
          },
        },
      },
    });
    let realm = await TestRealm.createWithAdapter(adapter, this.owner);
    await realm.ready;
    let indexer = realm.searchIndex;
    let entry = await indexer.card(
      new URL(`${testRealmURL}person-catalog-entry`)
    );
    if (entry?.type === 'doc') {
      assert.deepEqual(entry.doc.data, {
        id: `${testRealmURL}person-catalog-entry`,
        type: 'card',
        links: {
          self: `${testRealmURL}person-catalog-entry`,
        },
        attributes: {
          title: 'Person Card',
          description: 'Catalog entry for Person card',
          moduleHref: `${testRealmURL}person`,
          isPrimitive: false,
          ref: {
            module: `./person`,
            name: 'Person',
          },
          demo: {
            firstName: 'Mango',
          },
        },
        meta: {
          fields: {
            demo: {
              adoptsFrom: {
                module: `${testRealmURL}person`,
                name: 'Person',
              },
            },
          },
          adoptsFrom: {
            module: 'https://cardstack.com/base/catalog-entry',
            name: 'CatalogEntry',
          },
          lastModified: adapter.lastModified.get(
            `${testRealmURL}person-catalog-entry.json`
          ),
        },
      });
    } else {
      assert.ok(false, `search entry was an error: ${entry?.error.detail}`);
    }
  });

  test('can recover from rendering a card that has a template error', async function (assert) {
    {
      let adapter = new TestRealmAdapter({
        'person.gts': `
          import { contains, field, Card, Component } from "https://cardstack.com/base/card-api";
          import StringCard from "https://cardstack.com/base/string";

          export class Person extends Card {
            @field firstName = contains(StringCard);
            static isolated = class Isolated extends Component<typeof this> {
              <template>
                <h1><@fields.firstName/></h1>
              </template>
            }
          }
        `,
        'boom.gts': `
          import { contains, field, Card, Component } from "https://cardstack.com/base/card-api";
          import StringCard from "https://cardstack.com/base/string";

          export class Boom extends Card {
            @field firstName = contains(StringCard);
            static isolated = class Isolated extends Component<typeof this> {
              <template>
                <h1><@fields.firstName/>{{this.boom}}</h1>
              </template>
              get boom() {
                throw new Error('intentional error');
              }
            }
          }
        `,
        'vangogh.json': {
          data: {
            attributes: {
              firstName: 'Van Gogh',
            },
            meta: {
              adoptsFrom: {
                module: './person',
                name: 'Person',
              },
            },
          },
        },
        'boom.json': {
          data: {
            attributes: {
              firstName: 'Boom!',
            },
            meta: {
              adoptsFrom: {
                module: './boom',
                name: 'Boom',
              },
            },
          },
        },
      });
      let realm = await TestRealm.createWithAdapter(adapter, this.owner);
      await realm.ready;
      let indexer = realm.searchIndex;
      {
        let entry = await indexer.card(new URL(`${testRealmURL}boom`));
        if (entry?.type === 'error') {
          assert.strictEqual(
            entry.error.detail,
            'Encountered error rendering HTML for card: intentional error'
          );
          assert.deepEqual(entry.error.deps, [`${testRealmURL}boom`]);
        } else {
          assert.ok('false', 'expected search entry to be an error document');
        }
      }
      {
        let entry = await indexer.card(new URL(`${testRealmURL}vangogh`));
        if (entry?.type === 'doc') {
          assert.deepEqual(entry.doc.data.attributes?.firstName, 'Van Gogh');
          let { html } =
            (await indexer.searchEntry(new URL(`${testRealmURL}vangogh`))) ??
            {};
          assert.strictEqual(
            cleanWhiteSpace(html!),
            cleanWhiteSpace(`<h1> Van Gogh </h1>`)
          );
        } else {
          assert.ok(
            false,
            `expected search entry to be a document but was: ${entry?.error.detail}`
          );
        }
      }
    }

    {
      // perform a new index to assert that render stack is still consistent
      let adapter = new TestRealmAdapter({
        'person.gts': `
          import { contains, field, Card, Component } from "https://cardstack.com/base/card-api";
          import StringCard from "https://cardstack.com/base/string";

          export class Person extends Card {
            @field firstName = contains(StringCard);
            static isolated = class Isolated extends Component<typeof this> {
              <template>
                <h1><@fields.firstName/></h1>
              </template>
            }
          }
        `,
        'vangogh.json': {
          data: {
            attributes: {
              firstName: 'Van Gogh',
            },
            meta: {
              adoptsFrom: {
                module: './person',
                name: 'Person',
              },
            },
          },
        },
      });
      let realm = await TestRealm.createWithAdapter(adapter, this.owner);
      await realm.ready;
      let indexer = realm.searchIndex;
      {
        let entry = await indexer.card(new URL(`${testRealmURL}vangogh`));
        if (entry?.type === 'doc') {
          assert.deepEqual(entry.doc.data.attributes?.firstName, 'Van Gogh');
          let { html } =
            (await indexer.searchEntry(new URL(`${testRealmURL}vangogh`))) ??
            {};
          assert.strictEqual(
            cleanWhiteSpace(html!),
            cleanWhiteSpace(`<h1> Van Gogh </h1>`)
          );
        } else {
          assert.ok(
            false,
            `expected search entry to be a document but was: ${entry?.error.detail}`
          );
        }
      }
    }
  });

  test('can recover from rendering a card that has a nested card with a template error', async function (assert) {
    {
      let adapter = new TestRealmAdapter({
        'boom-person.gts': `
          import { contains, field, Card, Component } from "https://cardstack.com/base/card-api";
          import StringCard from "https://cardstack.com/base/string";
          import { Boom } from "./boom";

          export class BoomPerson extends Card {
            @field firstName = contains(StringCard);
            @field boom = contains(Boom);
            static isolated = class Isolated extends Component<typeof this> {
              <template>
                <h1><@fields.firstName/></h1>
                <h2><@fields.boom/></h2>
              </template>
            }
          }
        `,
        'boom.gts': `
          import { contains, field, Card, Component } from "https://cardstack.com/base/card-api";
          import StringCard from "https://cardstack.com/base/string";

          export class Boom extends Card {
            @field firstName = contains(StringCard);
            static embedded = class Embedded extends Component<typeof this> {
              <template>
                <h1><@fields.firstName/>{{this.boom}}</h1>
              </template>
              get boom() {
                throw new Error('intentional error');
              }
            }
          }
        `,
        'vangogh.json': {
          data: {
            attributes: {
              firstName: 'Van Gogh',
              boom: {
                firstName: 'Mango',
              },
            },
            meta: {
              adoptsFrom: {
                module: './boom-person',
                name: 'BoomPerson',
              },
            },
          },
        },
      });
      let realm = await TestRealm.createWithAdapter(adapter, this.owner);
      await realm.ready;
      let indexer = realm.searchIndex;
      let entry = await indexer.card(new URL(`${testRealmURL}vangogh`));
      if (entry?.type === 'error') {
        assert.strictEqual(
          entry.error.detail,
          'Encountered error rendering HTML for card: intentional error'
        );
      } else {
        assert.ok('false', 'expected search entry to be an error document');
      }
    }
    {
      // perform a new index to assert that render stack is still consistent
      let adapter = new TestRealmAdapter({
        'person.gts': `
          import { contains, field, Card, Component } from "https://cardstack.com/base/card-api";
          import StringCard from "https://cardstack.com/base/string";

          export class Person extends Card {
            @field firstName = contains(StringCard);
            static isolated = class Isolated extends Component<typeof this> {
              <template>
                <h1><@fields.firstName/></h1>
              </template>
            }
          }
        `,
        'vangogh.json': {
          data: {
            attributes: {
              firstName: 'Van Gogh',
            },
            meta: {
              adoptsFrom: {
                module: './person',
                name: 'Person',
              },
            },
          },
        },
      });
      let realm = await TestRealm.createWithAdapter(adapter, this.owner);
      await realm.ready;
      let indexer = realm.searchIndex;
      {
        let entry = await indexer.card(new URL(`${testRealmURL}vangogh`));
        if (entry?.type === 'doc') {
          assert.deepEqual(entry.doc.data.attributes?.firstName, 'Van Gogh');
          let { html } =
            (await indexer.searchEntry(new URL(`${testRealmURL}vangogh`))) ??
            {};
          assert.strictEqual(
            cleanWhiteSpace(html!),
            cleanWhiteSpace(`<h1> Van Gogh </h1>`)
          );
        } else {
          assert.ok(
            false,
            `expected search entry to be a document but was: ${entry?.error.detail}`
          );
        }
      }
    }
  });

  test('can recover from rendering a card that encounters a template error in its own custom component', async function (assert) {
    {
      let adapter = new TestRealmAdapter({
        'boom-person2.gts': `
          import { contains, field, Card, Component } from "https://cardstack.com/base/card-api";
          import StringCard from "https://cardstack.com/base/string";
          import { CustomBoom } from "./custom-boom";

          export class BoomPerson2 extends Card {
            @field firstName = contains(StringCard);
            @field boom = contains(CustomBoom);
            static isolated = class Isolated extends Component<typeof this> {
              <template>
                <h1><@fields.firstName/></h1>
                <h2><@fields.boom/></h2>
              </template>
            }
          }
        `,
        'custom-boom.gts': `
          import GlimmerComponent from '@glimmer/component';
          import { contains, field, Card, Component } from "https://cardstack.com/base/card-api";
          import StringCard from "https://cardstack.com/base/string";

          export class CustomBoom extends Card {
            @field firstName = contains(StringCard);
            static embedded = class Embedded extends Component<typeof this> {
              <template>
                <h1><@fields.firstName/><Custom/></h1>
              </template>
            }
          }
          class Custom extends GlimmerComponent {
            <template>{{this.boom}}</template>
            get boom() {
              throw new Error('intentional error');
            }
          }
        `,
        'vangogh.json': {
          data: {
            attributes: {
              firstName: 'Van Gogh',
              boom: {
                firstName: 'Mango',
              },
            },
            meta: {
              adoptsFrom: {
                module: './boom-person2',
                name: 'BoomPerson2',
              },
            },
          },
        },
      });
      let realm = await TestRealm.createWithAdapter(adapter, this.owner);
      await realm.ready;
      let indexer = realm.searchIndex;
      let entry = await indexer.card(new URL(`${testRealmURL}vangogh`));
      if (entry?.type === 'error') {
        assert.strictEqual(
          entry.error.detail,
          'Encountered error rendering HTML for card: intentional error'
        );
      } else {
        assert.ok('false', 'expected search entry to be an error document');
      }
    }
    {
      // perform a new index to assert that render stack is still consistent
      let adapter = new TestRealmAdapter({
        'person.gts': `
          import { contains, field, Card, Component } from "https://cardstack.com/base/card-api";
          import StringCard from "https://cardstack.com/base/string";

          export class Person extends Card {
            @field firstName = contains(StringCard);
            static isolated = class Isolated extends Component<typeof this> {
              <template>
                <h1><@fields.firstName/></h1>
              </template>
            }
          }
        `,
        'vangogh.json': {
          data: {
            attributes: {
              firstName: 'Van Gogh',
            },
            meta: {
              adoptsFrom: {
                module: './person',
                name: 'Person',
              },
            },
          },
        },
      });
      let realm = await TestRealm.createWithAdapter(adapter, this.owner);
      await realm.ready;
      let indexer = realm.searchIndex;
      {
        let entry = await indexer.card(new URL(`${testRealmURL}vangogh`));
        if (entry?.type === 'doc') {
          assert.deepEqual(entry.doc.data.attributes?.firstName, 'Van Gogh');
          let { html } =
            (await indexer.searchEntry(new URL(`${testRealmURL}vangogh`))) ??
            {};
          assert.strictEqual(
            cleanWhiteSpace(html!),
            cleanWhiteSpace(`<h1> Van Gogh </h1>`)
          );
        } else {
          assert.ok(
            false,
            `expected search entry to be a document but was: ${entry?.error.detail}`
          );
        }
      }
    }
  });

  test('can index a card with a containsMany composite containing a linkTo field', async function (assert) {
    let adapter = new TestRealmAdapter({
      'Vendor/vendor1.json': {
        data: {
          id: `${testRealmURL}Vendor/vendor1`,
          attributes: {
            name: 'Acme Industries',
            paymentMethods: [
              {
                type: 'crypto',
                payment: {
                  address: '0x1111',
                },
              },
              {
                type: 'crypto',
                payment: {
                  address: '0x2222',
                },
              },
            ],
          },
          relationships: {
            'paymentMethods.0.payment.chain': {
              links: {
                self: `${testRealmURL}Chain/1`,
              },
            },
            'paymentMethods.1.payment.chain': {
              links: {
                self: `${testRealmURL}Chain/2`,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: `http://localhost:4202/test/vendor`,
              name: 'Vendor',
            },
          },
        },
      },
      'Chain/1.json': {
        data: {
          id: `${testRealmURL}Chain/1`,
          attributes: {
            name: 'Ethereum Mainnet',
          },
          meta: {
            adoptsFrom: {
              module: `http://localhost:4202/test/chain`,
              name: 'Chain',
            },
          },
        },
      },
      'Chain/2.json': {
        data: {
          id: `${testRealmURL}Chain/2`,
          attributes: {
            name: 'Polygon',
          },
          meta: {
            adoptsFrom: {
              module: `http://localhost:4202/test/chain`,
              name: 'Chain',
            },
          },
        },
      },
    });
    let realm = await TestRealm.createWithAdapter(adapter, this.owner);
    await realm.ready;
    let indexer = realm.searchIndex;
    let vendor = await indexer.card(new URL(`${testRealmURL}Vendor/vendor1`), {
      loadLinks: true,
    });
    if (vendor?.type === 'doc') {
      assert.deepEqual(vendor.doc, {
        data: {
          id: `${testRealmURL}Vendor/vendor1`,
          type: 'card',
          links: {
            self: `${testRealmURL}Vendor/vendor1`,
          },
          attributes: {
            name: 'Acme Industries',
            paymentMethods: [
              {
                type: 'crypto',
                payment: {
                  address: '0x1111',
                },
              },
              {
                type: 'crypto',
                payment: {
                  address: '0x2222',
                },
              },
            ],
          },
          relationships: {
            'paymentMethods.0.payment.chain': {
              data: {
                id: `${testRealmURL}Chain/1`,
                type: 'card',
              },
              links: {
                self: `${testRealmURL}Chain/1`,
              },
            },
            'paymentMethods.1.payment.chain': {
              data: {
                id: `${testRealmURL}Chain/2`,
                type: 'card',
              },
              links: {
                self: `${testRealmURL}Chain/2`,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: `http://localhost:4202/test/vendor`,
              name: 'Vendor',
            },
            lastModified: adapter.lastModified.get(
              `${testRealmURL}Vendor/vendor1.json`
            ),
          },
        },
        included: [
          {
            id: `${testRealmURL}Chain/1`,
            type: 'card',
            links: {
              self: `${testRealmURL}Chain/1`,
            },
            attributes: {
              name: 'Ethereum Mainnet',
              chainId: 1,
            },

            meta: {
              adoptsFrom: {
                module: `http://localhost:4202/test/chain`,
                name: 'Chain',
              },
              lastModified: adapter.lastModified.get(
                `${testRealmURL}Chain/1.json`
              ),
            },
          },
          {
            id: `${testRealmURL}Chain/2`,
            type: 'card',
            links: {
              self: `${testRealmURL}Chain/2`,
            },
            attributes: {
              name: 'Polygon',
              chainId: 137,
            },
            meta: {
              adoptsFrom: {
                module: `http://localhost:4202/test/chain`,
                name: 'Chain',
              },
              lastModified: adapter.lastModified.get(
                `${testRealmURL}Chain/2.json`
              ),
            },
          },
        ],
      });
    } else {
      assert.ok(false, `search entry was an error: ${vendor?.error.detail}`);
    }
  });

  test('can tolerate a card whose computed throws an exception', async function (assert) {
    let adapter = new TestRealmAdapter({
      'Boom/boom.json': {
        data: {
          id: `${testRealmURL}Boom/boom`,
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/card-with-error',
              name: 'Boom',
            },
          },
        },
      },
      'Person/owner.json': {
        data: {
          id: `${testRealmURL}Person/owner`,
          attributes: {
            firstName: 'Hassan',
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/person',
              name: 'Person',
            },
          },
        },
      },
    });
    let realm = await TestRealm.createWithAdapter(adapter, this.owner);
    await realm.ready;
    let indexer = realm.searchIndex;
    {
      let card = await indexer.card(new URL(`${testRealmURL}Boom/boom`));
      if (card?.type === 'error') {
        assert.ok(
          card.error.detail.includes('intentional error thrown'),
          'error doc includes raised error message'
        );
      } else {
        assert.ok(false, `expected search entry to be an error doc`);
      }
    }

    {
      let card = await indexer.card(new URL(`${testRealmURL}Person/owner`));
      if (card?.type === 'doc') {
        assert.strictEqual(card.doc.data.attributes?.firstName, 'Hassan');
      } else {
        assert.ok(false, `search entry was an error: ${card?.error.detail}`);
      }
    }
  });

  test('search doc only includes used fields', async function (assert) {
    let adapter = new TestRealmAdapter({
      'Person/hassan.json': {
        data: {
          id: `${testRealmURL}Person/hassan`,
          attributes: {
            firstName: 'Hassan',
            lastName: 'Abdel-Rahman',
            email: 'hassan@cardstack.com',
            posts: 100,
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/person',
              name: 'Person',
            },
          },
        },
      },
    });
    let realm = await TestRealm.createWithAdapter(adapter, this.owner);
    await realm.ready;
    let indexer = realm.searchIndex;
    let entry = await indexer.searchEntry(
      new URL(`${testRealmURL}Person/hassan`)
    );
    assert.deepEqual(
      entry?.searchData,
      {
        id: `${testRealmURL}Person/hassan`,
        firstName: 'Hassan',
        lastName: 'Abdel-Rahman',
        email: 'hassan@cardstack.com',
        posts: 100,
      },
      `search doc does not include fullName field`
    );
  });

  test('search doc normalizes containsMany composite fields', async function (assert) {
    let adapter = new TestRealmAdapter({
      'CatalogEntry/booking.json': {
        data: {
          attributes: {
            title: 'Booking',
            description: 'Catalog entry for Booking',
            ref: {
              module: 'http://localhost:4202/test/booking',
              name: 'Booking',
            },
            demo: {
              title: null,
              venue: null,
              startTime: null,
              endTime: null,
              hosts: [],
              sponsors: [],
            },
          },
          meta: {
            fields: {
              demo: {
                adoptsFrom: {
                  module: 'http://localhost:4202/test/booking',
                  name: 'Booking',
                },
              },
            },
            adoptsFrom: {
              module: 'https://cardstack.com/base/catalog-entry',
              name: 'CatalogEntry',
            },
          },
        },
      },
    });
    let realm = await TestRealm.createWithAdapter(adapter, this.owner);
    await realm.ready;
    let indexer = realm.searchIndex;
    let entry = await indexer.searchEntry(
      new URL(`${testRealmURL}CatalogEntry/booking`)
    );
    assert.deepEqual(entry?.searchData, {
      id: `${testRealmURL}CatalogEntry/booking`,
      demo: {
        endTime: undefined,
        hosts: [],
        id: undefined,
        sponsors: [],
        startTime: undefined,
        title: null,
        venue: null,
      },
      description: 'Catalog entry for Booking',
      isPrimitive: false,
      moduleHref: 'http://localhost:4202/test/booking',
      ref: 'http://localhost:4202/test/booking/Booking',
      title: 'Booking',
    });
    // we should be able to perform a structured clone of the search doc (this
    // emulates the limitations of the postMessage used to communicate between
    // DOM and worker). Success is not throwing an error
    structuredClone(entry?.searchData);
  });

  test('can index a card with linksToMany field', async function (assert) {
    let adapter = new TestRealmAdapter({
      'Pet/vanGogh.json': {
        data: {
          attributes: { firstName: 'Van Gogh' },
          meta: {
            adoptsFrom: {
              module: `${testModuleRealm}pet`,
              name: 'Pet',
            },
          },
        },
      },
      'PetPerson/hassan.json': {
        data: {
          attributes: { firstName: 'Hassan' },
          relationships: {
            'pets.0': {
              links: { self: `${testRealmURL}Pet/mango` },
            },
            'pets.1': {
              links: { self: `${testRealmURL}Pet/vanGogh` },
            },
          },
          meta: {
            adoptsFrom: {
              module: `${testModuleRealm}pet-person`,
              name: 'PetPerson',
            },
          },
        },
      },
      'Pet/mango.json': {
        data: {
          attributes: { firstName: 'Mango' },
          meta: {
            adoptsFrom: {
              module: `${testModuleRealm}pet`,
              name: 'Pet',
            },
          },
        },
      },
    });

    let realm = await TestRealm.createWithAdapter(adapter, this.owner);
    await realm.ready;
    let indexer = realm.searchIndex;
    let hassan = await indexer.card(
      new URL(`${testRealmURL}PetPerson/hassan`),
      { loadLinks: true }
    );

    if (hassan?.type === 'doc') {
      assert.deepEqual(hassan.doc.data, {
        id: `${testRealmURL}PetPerson/hassan`,
        type: 'card',
        links: { self: `${testRealmURL}PetPerson/hassan` },
        attributes: { firstName: 'Hassan' },
        relationships: {
          'pets.0': {
            links: { self: `${testRealmURL}Pet/mango` },
            data: { id: `${testRealmURL}Pet/mango`, type: 'card' },
          },
          'pets.1': {
            links: { self: `${testRealmURL}Pet/vanGogh` },
            data: { id: `${testRealmURL}Pet/vanGogh`, type: 'card' },
          },
        },
        meta: {
          adoptsFrom: {
            module: `${testModuleRealm}pet-person`,
            name: 'PetPerson',
          },
          lastModified: adapter.lastModified.get(
            `${testRealmURL}PetPerson/hassan.json`
          ),
        },
      });
      assert.deepEqual(hassan.doc.included, [
        {
          id: `${testRealmURL}Pet/mango`,
          type: 'card',
          links: { self: `${testRealmURL}Pet/mango` },
          attributes: { firstName: 'Mango' },
          relationships: { owner: { links: { self: null } } },
          meta: {
            adoptsFrom: { module: `${testModuleRealm}pet`, name: 'Pet' },
            lastModified: adapter.lastModified.get(
              `${testRealmURL}Pet/mango.json`
            ),
          },
        },
        {
          id: `${testRealmURL}Pet/vanGogh`,
          type: 'card',
          links: { self: `${testRealmURL}Pet/vanGogh` },
          attributes: { firstName: 'Van Gogh' },
          relationships: { owner: { links: { self: null } } },
          meta: {
            adoptsFrom: { module: `${testModuleRealm}pet`, name: 'Pet' },
            lastModified: adapter.lastModified.get(
              `${testRealmURL}Pet/vanGogh.json`
            ),
          },
        },
      ]);
    } else {
      assert.ok(false, `search entry was an error: ${hassan?.error.detail}`);
    }

    let hassanEntry = await indexer.searchEntry(
      new URL(`${testRealmURL}PetPerson/hassan`)
    );
    if (hassanEntry) {
      assert.deepEqual(hassanEntry.searchData, {
        id: `${testRealmURL}PetPerson/hassan`,
        firstName: 'Hassan',
        pets: [
          {
            id: `${testRealmURL}Pet/mango`,
            firstName: 'Mango',
            owner: null,
          },
          {
            id: `${testRealmURL}Pet/vanGogh`,
            firstName: 'Van Gogh',
            owner: null,
          },
        ],
      });
    } else {
      assert.ok(
        false,
        `could not find ${testRealmURL}PetPerson/hassan in the index`
      );
    }
  });

  test('can index a card with empty linksToMany field value', async function (assert) {
    let adapter = new TestRealmAdapter({
      'PetPerson/burcu.json': {
        data: {
          attributes: { firstName: 'Burcu' },
          relationships: { pets: { links: { self: null } } },
          meta: {
            adoptsFrom: {
              module: `${testModuleRealm}pet-person`,
              name: 'PetPerson',
            },
          },
        },
      },
    });

    let realm = await TestRealm.createWithAdapter(adapter, this.owner);
    await realm.ready;
    let indexer = realm.searchIndex;
    let card = await indexer.card(new URL(`${testRealmURL}PetPerson/burcu`), {
      loadLinks: true,
    });

    if (card?.type === 'doc') {
      assert.deepEqual(card.doc, {
        data: {
          id: `${testRealmURL}PetPerson/burcu`,
          type: 'card',
          links: { self: `${testRealmURL}PetPerson/burcu` },
          attributes: { firstName: 'Burcu' },
          relationships: { pets: { links: { self: null } } },
          meta: {
            adoptsFrom: {
              module: `${testModuleRealm}pet-person`,
              name: 'PetPerson',
            },
            lastModified: adapter.lastModified.get(
              `${testRealmURL}PetPerson/burcu.json`
            ),
          },
        },
      });
    } else {
      assert.ok(false, `search entry was an error: ${card?.error.detail}`);
    }

    let entry = await indexer.searchEntry(
      new URL(`${testRealmURL}PetPerson/burcu`)
    );
    if (entry) {
      assert.deepEqual(entry.searchData, {
        id: `${testRealmURL}PetPerson/burcu`,
        firstName: 'Burcu',
        pets: [],
      });
    } else {
      assert.ok(
        false,
        `could not find ${testRealmURL}PetPerson/burcu in the index`
      );
    }
  });

  test('can index a card that has nested linksTo fields', async function (assert) {
    let adapter = new TestRealmAdapter({
      'Friend/hassan.json': {
        data: {
          id: `${testRealmURL}Friend/hassan`,
          attributes: {
            firstName: 'Hassan',
          },
          relationships: {
            friend: {
              links: {
                self: `${testRealmURL}Friend/mango`,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/friend',
              name: 'Friend',
            },
          },
        },
      },
      'Friend/mango.json': {
        data: {
          id: `${testRealmURL}Friend/mango`,
          attributes: {
            firstName: 'Mango',
          },
          relationships: {
            friend: {
              links: {
                self: `${testRealmURL}Friend/vanGogh`,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/friend',
              name: 'Friend',
            },
          },
        },
      },
      'Friend/vanGogh.json': {
        data: {
          id: `${testRealmURL}Friend/vanGogh`,
          attributes: {
            firstName: 'Van Gogh',
          },
          relationships: {
            friend: {
              links: {
                self: null,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/friend',
              name: 'Friend',
            },
          },
        },
      },
    });
    let realm = await TestRealm.createWithAdapter(adapter, this.owner);
    await realm.ready;
    let indexer = realm.searchIndex;
    let hassan = await indexer.card(new URL(`${testRealmURL}Friend/hassan`));
    if (hassan?.type === 'doc') {
      assert.deepEqual(hassan.doc.data, {
        id: `${testRealmURL}Friend/hassan`,
        type: 'card',
        links: {
          self: `${testRealmURL}Friend/hassan`,
        },
        attributes: {
          firstName: 'Hassan',
        },
        relationships: {
          friend: {
            links: {
              self: `${testRealmURL}Friend/mango`,
            },
          },
        },
        meta: {
          adoptsFrom: {
            module: 'http://localhost:4202/test/friend',
            name: 'Friend',
          },
          lastModified: adapter.lastModified.get(
            `${testRealmURL}Friend/hassan.json`
          ),
        },
      });
    } else {
      assert.ok(false, `search entry was an error: ${hassan?.error.detail}`);
    }

    let hassanEntry = await indexer.searchEntry(
      new URL(`${testRealmURL}Friend/hassan`)
    );
    if (hassanEntry) {
      assert.deepEqual(hassanEntry.searchData, {
        id: `${testRealmURL}Friend/hassan`,
        firstName: 'Hassan',
        friend: {
          id: `${testRealmURL}Friend/mango`,
          firstName: 'Mango',
          friend: {
            id: `${testRealmURL}Friend/vanGogh`,
            firstName: 'Van Gogh',
            friend: null,
          },
        },
      });
    } else {
      assert.ok(
        false,
        `could not find ${testRealmURL}Friend/hassan in the index`
      );
    }
  });

  test('can index a field with a cycle in the linksTo field', async function (assert) {
    let adapter = new TestRealmAdapter({
      'Friend/hassan.json': {
        data: {
          id: `${testRealmURL}Friend/hassan`,
          attributes: {
            firstName: 'Hassan',
          },
          relationships: {
            friend: {
              links: {
                self: `${testRealmURL}Friend/mango`,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/friend',
              name: 'Friend',
            },
          },
        },
      },
      'Friend/mango.json': {
        data: {
          id: `${testRealmURL}Friend/mango`,
          attributes: {
            firstName: 'Mango',
          },
          relationships: {
            friend: {
              links: {
                self: `${testRealmURL}Friend/hassan`,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/friend',
              name: 'Friend',
            },
          },
        },
      },
    });
    let realm = await TestRealm.createWithAdapter(adapter, this.owner);
    await realm.ready;
    let indexer = realm.searchIndex;
    let hassan = await indexer.card(new URL(`${testRealmURL}Friend/hassan`), {
      loadLinks: true,
    });
    if (hassan?.type === 'doc') {
      assert.deepEqual(hassan.doc, {
        data: {
          id: `${testRealmURL}Friend/hassan`,
          type: 'card',
          links: { self: `${testRealmURL}Friend/hassan` },
          attributes: {
            firstName: 'Hassan',
          },
          relationships: {
            friend: {
              links: {
                self: `${testRealmURL}Friend/mango`,
              },
              data: {
                type: 'card',
                id: `${testRealmURL}Friend/mango`,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/friend',
              name: 'Friend',
            },
            lastModified: adapter.lastModified.get(
              `${testRealmURL}Friend/hassan.json`
            ),
          },
        },
        included: [
          {
            id: `${testRealmURL}Friend/mango`,
            type: 'card',
            links: { self: `${testRealmURL}Friend/mango` },
            attributes: {
              firstName: 'Mango',
            },
            relationships: {
              friend: {
                links: {
                  self: `${testRealmURL}Friend/hassan`,
                },
                data: {
                  type: 'card',
                  id: `${testRealmURL}Friend/hassan`,
                },
              },
            },
            meta: {
              adoptsFrom: {
                module: 'http://localhost:4202/test/friend',
                name: 'Friend',
              },
              lastModified: adapter.lastModified.get(
                `${testRealmURL}Friend/mango.json`
              ),
            },
          },
        ],
      });
    } else {
      assert.ok(false, `search entry was an error: ${hassan?.error.detail}`);
    }

    let hassanEntry = await indexer.searchEntry(
      new URL(`${testRealmURL}Friend/hassan`)
    );
    if (hassanEntry) {
      assert.deepEqual(hassanEntry.searchData, {
        id: `${testRealmURL}Friend/hassan`,
        firstName: 'Hassan',
        friend: {
          id: `${testRealmURL}Friend/mango`,
          firstName: 'Mango',
          friend: {
            id: `${testRealmURL}Friend/hassan`,
          },
        },
      });
    } else {
      assert.ok(
        false,
        `could not find ${testRealmURL}Friend/hassan in the index`
      );
    }

    let mango = await indexer.card(new URL(`${testRealmURL}Friend/mango`), {
      loadLinks: true,
    });
    if (mango?.type === 'doc') {
      assert.deepEqual(mango.doc, {
        data: {
          id: `${testRealmURL}Friend/mango`,
          type: 'card',
          links: { self: `${testRealmURL}Friend/mango` },
          attributes: {
            firstName: 'Mango',
          },
          relationships: {
            friend: {
              links: {
                self: `${testRealmURL}Friend/hassan`,
              },
              data: {
                type: 'card',
                id: `${testRealmURL}Friend/hassan`,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: 'http://localhost:4202/test/friend',
              name: 'Friend',
            },
            lastModified: adapter.lastModified.get(
              `${testRealmURL}Friend/mango.json`
            ),
          },
        },
        included: [
          {
            id: `${testRealmURL}Friend/hassan`,
            type: 'card',
            links: { self: `${testRealmURL}Friend/hassan` },
            attributes: {
              firstName: 'Hassan',
            },
            relationships: {
              friend: {
                links: {
                  self: `${testRealmURL}Friend/mango`,
                },
                data: {
                  type: 'card',
                  id: `${testRealmURL}Friend/mango`,
                },
              },
            },
            meta: {
              adoptsFrom: {
                module: 'http://localhost:4202/test/friend',
                name: 'Friend',
              },
              lastModified: adapter.lastModified.get(
                `${testRealmURL}Friend/hassan.json`
              ),
            },
          },
        ],
      });
    } else {
      assert.ok(false, `search entry was an error: ${mango?.error.detail}`);
    }

    let mangoEntry = await indexer.searchEntry(
      new URL(`${testRealmURL}Friend/mango`)
    );
    if (mangoEntry) {
      assert.deepEqual(mangoEntry.searchData, {
        id: `${testRealmURL}Friend/mango`,
        firstName: 'Mango',
        friend: {
          id: `${testRealmURL}Friend/hassan`,
          firstName: 'Hassan',
          friend: {
            id: `${testRealmURL}Friend/mango`,
          },
        },
      });
    } else {
      assert.ok(
        false,
        `could not find ${testRealmURL}Friend/mango in the index`
      );
    }
  });

  test('can index a field with a cycle in the linksToMany field', async function (assert) {
    let hassanID = `${testRealmURL}Friends/hassan`;
    let mangoID = `${testRealmURL}Friends/mango`;
    let vanGoghID = `${testRealmURL}Friends/vanGogh`;
    let friendsRef = { module: `${testModuleRealm}friends`, name: 'Friends' };
    let adapter = new TestRealmAdapter({
      'Friends/vanGogh.json': {
        data: {
          attributes: { firstName: 'Van Gogh' },
          relationships: { 'friends.0': { links: { self: hassanID } } },
          meta: { adoptsFrom: friendsRef },
        },
      },
      'Friends/hassan.json': {
        data: {
          attributes: { firstName: 'Hassan' },
          relationships: {
            'friends.0': { links: { self: mangoID } },
            'friends.1': { links: { self: vanGoghID } },
          },
          meta: { adoptsFrom: friendsRef },
        },
      },
      'Friends/mango.json': {
        data: {
          attributes: { firstName: 'Mango' },
          relationships: { 'friends.0': { links: { self: hassanID } } },
          meta: { adoptsFrom: friendsRef },
        },
      },
    });
    let realm = await TestRealm.createWithAdapter(adapter, this.owner);
    await realm.ready;
    let indexer = realm.searchIndex;
    assert.deepEqual(
      indexer.stats,
      {
        instanceErrors: 0,
        instancesIndexed: 3,
        moduleErrors: 0,
      },
      'instances are indexed without error'
    );

    let hassan = await indexer.card(new URL(hassanID), { loadLinks: true });
    if (hassan?.type === 'doc') {
      assert.deepEqual(
        hassan.doc.data,
        {
          id: hassanID,
          type: 'card',
          links: { self: hassanID },
          attributes: { firstName: 'Hassan' },
          relationships: {
            'friends.0': {
              links: { self: mangoID },
              data: { type: 'card', id: mangoID },
            },
            'friends.1': {
              links: { self: vanGoghID },
              data: { type: 'card', id: vanGoghID },
            },
          },
          meta: {
            adoptsFrom: friendsRef,
            lastModified: adapter.lastModified.get(`${hassanID}.json`),
          },
        },
        'hassan doc.data is correct'
      );

      assert.deepEqual(
        hassan.doc.included,
        [
          {
            id: mangoID,
            type: 'card',
            links: { self: mangoID },
            attributes: { firstName: 'Mango' },
            relationships: {
              'friends.0': {
                links: { self: hassanID },
                data: { type: 'card', id: hassanID },
              },
            },
            meta: {
              adoptsFrom: friendsRef,
              lastModified: adapter.lastModified.get(`${mangoID}.json`),
            },
          },
          {
            id: vanGoghID,
            type: 'card',
            links: { self: vanGoghID },
            attributes: { firstName: 'Van Gogh' },
            relationships: {
              'friends.0': {
                links: { self: hassanID },
                data: { type: 'card', id: hassanID },
              },
            },
            meta: {
              adoptsFrom: friendsRef,
              lastModified: adapter.lastModified.get(`${vanGoghID}.json`),
            },
          },
        ],
        'hassan doc.included is correct'
      );
    } else {
      assert.ok(false, `search entry was an error: ${hassan?.error.detail}`);
    }

    let hassanEntry = await indexer.searchEntry(new URL(hassanID));
    if (hassanEntry) {
      assert.deepEqual(
        hassanEntry.searchData,
        {
          id: hassanID,
          firstName: 'Hassan',
          friends: [
            {
              id: mangoID,
              firstName: 'Mango',
              friends: [{ id: hassanID }],
            },
            {
              id: vanGoghID,
              firstName: 'Van Gogh',
              friends: [{ id: hassanID }],
            },
          ],
        },
        'hassan searchData is correct'
      );
    } else {
      assert.ok(false, `could not find ${hassanID} in the index`);
    }

    let mango = await indexer.card(new URL(mangoID), { loadLinks: true });
    if (mango?.type === 'doc') {
      assert.deepEqual(
        mango.doc.data,
        {
          id: mangoID,
          type: 'card',
          links: { self: mangoID },
          attributes: { firstName: 'Mango' },
          relationships: {
            'friends.0': {
              links: { self: hassanID },
              data: { type: 'card', id: hassanID },
            },
          },
          meta: {
            adoptsFrom: friendsRef,
            lastModified: adapter.lastModified.get(`${mangoID}.json`),
          },
        },
        'mango doc.data is correct'
      );
      assert.deepEqual(
        mango.doc.included,
        [
          {
            id: hassanID,
            type: 'card',
            links: { self: hassanID },
            attributes: { firstName: 'Hassan' },
            relationships: {
              'friends.0': {
                links: { self: mangoID },
                data: { type: 'card', id: mangoID },
              },
              'friends.1': {
                links: { self: vanGoghID },
                data: { type: 'card', id: vanGoghID },
              },
            },
            meta: {
              adoptsFrom: friendsRef,
              lastModified: adapter.lastModified.get(`${hassanID}.json`),
            },
          },
          {
            id: vanGoghID,
            type: 'card',
            links: { self: vanGoghID },
            attributes: { firstName: 'Van Gogh' },
            relationships: {
              'friends.0': {
                links: { self: hassanID },
                data: { type: 'card', id: hassanID },
              },
            },
            meta: {
              adoptsFrom: friendsRef,
              lastModified: adapter.lastModified.get(`${vanGoghID}.json`),
            },
          },
        ],
        'mango doc.included is correct'
      );
    } else {
      assert.ok(false, `search entry was an error: ${mango?.error.detail}`);
    }

    let mangoEntry = await indexer.searchEntry(new URL(mangoID));
    if (mangoEntry) {
      assert.deepEqual(
        mangoEntry.searchData,
        {
          id: mangoID,
          firstName: 'Mango',
          friends: [
            {
              id: hassanID,
              firstName: 'Hassan',
              friends: [
                { id: mangoID },
                {
                  id: vanGoghID,
                  firstName: 'Van Gogh',
                  friends: [{ id: hassanID }],
                },
              ],
            },
          ],
        },
        'mango searchData is correct'
      );
    } else {
      assert.ok(false, `could not find ${mangoID} in the index`);
    }

    let vanGogh = await indexer.card(new URL(vanGoghID), { loadLinks: true });
    if (vanGogh?.type === 'doc') {
      assert.deepEqual(
        vanGogh.doc.data,
        {
          id: vanGoghID,
          type: 'card',
          links: { self: vanGoghID },
          attributes: { firstName: 'Van Gogh' },
          relationships: {
            'friends.0': {
              links: { self: hassanID },
              data: { type: 'card', id: hassanID },
            },
          },
          meta: {
            adoptsFrom: friendsRef,
            lastModified: adapter.lastModified.get(`${vanGoghID}.json`),
          },
        },
        'vanGogh doc.data is correct'
      );
      assert.deepEqual(
        vanGogh.doc.included,
        [
          {
            id: hassanID,
            type: 'card',
            links: { self: hassanID },
            attributes: { firstName: 'Hassan' },
            relationships: {
              'friends.0': {
                links: { self: mangoID },
                data: { type: 'card', id: mangoID },
              },
              'friends.1': {
                links: { self: vanGoghID },
                data: { type: 'card', id: vanGoghID },
              },
            },
            meta: {
              adoptsFrom: friendsRef,
              lastModified: adapter.lastModified.get(`${hassanID}.json`),
            },
          },
          {
            id: mangoID,
            type: 'card',
            links: { self: mangoID },
            attributes: { firstName: 'Mango' },
            relationships: {
              'friends.0': {
                links: { self: hassanID },
                data: { type: 'card', id: hassanID },
              },
            },
            meta: {
              adoptsFrom: friendsRef,
              lastModified: adapter.lastModified.get(`${mangoID}.json`),
            },
          },
        ],
        'vanGogh doc.included is correct'
      );
    } else {
      assert.ok(false, `search entry was an error: ${vanGogh?.error.detail}`);
    }

    let vanGoghEntry = await indexer.searchEntry(new URL(vanGoghID));
    if (vanGoghEntry) {
      assert.deepEqual(
        vanGoghEntry.searchData,
        {
          id: vanGoghID,
          firstName: 'Van Gogh',
          friends: [
            {
              id: hassanID,
              firstName: 'Hassan',
              friends: [
                {
                  id: mangoID,
                  firstName: 'Mango',
                  friends: [{ id: hassanID }],
                },
                { id: vanGoghID },
              ],
            },
          ],
        },
        'vanGogh searchData is correct'
      );
    } else {
      assert.ok(false, `could not find ${vanGoghID} in the index`);
    }
  });

  test("indexing identifies an instance's card references", async function (assert) {
    let realm = await TestRealm.create(
      {
        'person-1.json': {
          data: {
            attributes: {
              firstName: 'Mango',
            },
            meta: {
              adoptsFrom: {
                module: `${testModuleRealm}person`,
                name: 'Person',
              },
            },
          },
        },
      },
      this.owner
    );
    await realm.ready;
    let indexer = realm.searchIndex;
    let refs = (await indexer.searchEntry(new URL(`${testRealmURL}person-1`)))
      ?.deps;
    assert.deepEqual(
      [...refs!.keys()].sort(),
      [
        '@cardstack/boxel-ui',
        '@cardstack/boxel-ui/helpers/pick',
        '@cardstack/boxel-ui/helpers/truth-helpers',
        '@cardstack/runtime-common',
        '@ember/component',
        '@ember/component/template-only',
        '@ember/helper',
        '@ember/modifier',
        '@ember/template-factory',
        '@glimmer/component',
        'ember-concurrency',
        'ember-concurrency/-private/async-arrow-runtime',
        'http://localhost:4201/base/card-api',
        'http://localhost:4201/base/contains-many-component',
        'http://localhost:4201/base/default-card-component',
        'http://localhost:4201/base/field-component',
        'http://localhost:4201/base/integer',
        'http://localhost:4201/base/links-to-editor',
        'http://localhost:4201/base/links-to-many-component',
        'http://localhost:4201/base/string',
        'http://localhost:4201/base/watched-array',
        'http://localhost:4202/test/person',
        'lodash',
        'tracked-built-ins',
      ],
      'the card references for the instance are correct'
    );
  });

  test('search index does not contain entries that match patterns in ignore files', async function (assert) {
    let realm = await TestRealm.create(
      {
        'ignore-me-1.json': { data: { meta: { adoptsFrom: baseCardRef } } },
        'posts/nested.json': { data: { meta: { adoptsFrom: baseCardRef } } },
        'posts/please-ignore-me.json': {
          data: { meta: { adoptsFrom: baseCardRef } },
        },
        'posts/ignore-me-2.json': {
          data: { meta: { adoptsFrom: baseCardRef } },
        },
        'post.json': { data: { meta: { adoptsFrom: baseCardRef } } },
        'dir/card.json': { data: { meta: { adoptsFrom: baseCardRef } } },
        '.gitignore': `
ignore-me*.json
dir/
posts/please-ignore-me.json
      `,
      },
      this.owner
    );

    await realm.ready;
    let indexer = realm.searchIndex;

    {
      let card = await indexer.card(
        new URL(`${testRealmURL}posts/please-ignore-me`)
      );
      assert.deepEqual(
        card,
        undefined,
        'instance does not exist because file is ignored'
      );
    }
    {
      let card = await indexer.card(new URL(`${testRealmURL}dir/card`));
      assert.deepEqual(
        card,
        undefined,
        'instance does not exist because file is ignored'
      );
    }
    {
      let card = await indexer.card(new URL(`${testRealmURL}ignore-me-1`));
      assert.deepEqual(
        card,
        undefined,
        'instance does not exist because file is ignored'
      );
    }
    {
      let card = await indexer.card(
        new URL(`${testRealmURL}posts/ignore-me-2`)
      );
      assert.deepEqual(
        card,
        undefined,
        'instance does not exist because file is ignored'
      );
    }
    {
      let card = await indexer.card(new URL(`${testRealmURL}post`));
      assert.ok(card, 'instance exists');
    }
    {
      let card = await indexer.card(new URL(`${testRealmURL}posts/nested`));
      assert.ok(card, 'instance exists');
    }
  });

  test("incremental indexing doesn't process ignored files", async function (assert) {
    let realm = await TestRealm.create(
      {
        'posts/ignore-me.json': { data: { meta: { adoptsFrom: baseCardRef } } },
        '.gitignore': `
posts/ignore-me.json
      `,
      },
      this.owner
    );

    await realm.ready;
    let indexer = realm.searchIndex;
    await indexer.update(new URL(`${testRealmURL}posts/ignore-me.json`));

    let instance = await indexer.card(
      new URL(`${testRealmURL}posts/ignore-me`)
    );
    assert.strictEqual(
      instance,
      undefined,
      'instance does not exist because file is ignored'
    );
    assert.strictEqual(
      indexer.stats.instancesIndexed,
      0,
      'no instances were processed'
    );
  });

  module('query', function (hooks) {
    const sampleCards: CardDocFiles = {
      'card-1.json': {
        data: {
          type: 'card',
          attributes: {
            title: 'Card 1',
            description: 'Sample post',
            author: {
              firstName: 'Cardy',
              lastName: 'Stackington Jr. III',
            },
            views: 0,
          },
          meta: {
            adoptsFrom: {
              module: `${testModuleRealm}article`,
              name: 'Article',
            },
          },
        },
      },
      'card-2.json': {
        data: {
          type: 'card',
          attributes: { author: { firstName: 'Cardy' }, editions: 1 },
          meta: {
            adoptsFrom: { module: `${testModuleRealm}book`, name: 'Book' },
          },
        },
      },
      'cards/1.json': {
        data: {
          type: 'card',
          attributes: {
            title: 'Card 1',
            description: 'Sample post',
            author: {
              firstName: 'Carl',
              lastName: 'Stack',
              posts: 1,
            },
            createdAt: new Date(2022, 7, 1),
            views: 10,
          },
          meta: {
            adoptsFrom: { module: `${testModuleRealm}post`, name: 'Post' },
          },
        },
      },
      'cards/2.json': {
        data: {
          type: 'card',
          attributes: {
            title: 'Card 2',
            description: 'Sample post',
            author: {
              firstName: 'Carl',
              lastName: 'Deck',
              posts: 3,
            },
            createdAt: new Date(2022, 7, 22),
            views: 5,
          },
          meta: {
            adoptsFrom: {
              module: `${testModuleRealm}article`,
              name: 'Article',
            },
          },
        },
      },
      'books/1.json': {
        data: {
          type: 'card',
          attributes: {
            author: {
              firstName: 'Mango',
              lastName: 'Abdel-Rahman',
            },
            editions: 1,
            pubDate: '2022-07-01',
          },
          meta: {
            adoptsFrom: { module: `${testModuleRealm}book`, name: 'Book' },
          },
        },
      },
      'books/2.json': {
        data: {
          type: 'card',
          attributes: {
            author: {
              firstName: 'Van Gogh',
              lastName: 'Abdel-Rahman',
            },
            editions: 0,
            pubDate: '2023-08-01',
          },
          meta: {
            adoptsFrom: { module: `${testModuleRealm}book`, name: 'Book' },
          },
        },
      },
      'books/3.json': {
        data: {
          type: 'card',
          attributes: {
            author: {
              firstName: 'Jackie',
              lastName: 'Aguilar',
            },
            editions: 2,
            pubDate: '2022-08-01',
          },
          meta: {
            adoptsFrom: { module: `${testModuleRealm}book`, name: 'Book' },
          },
        },
      },
      'catalog-entry-1.json': {
        data: {
          type: 'card',
          attributes: {
            title: 'Post',
            description: 'A card that represents a blog post',
            ref: {
              module: `${testModuleRealm}post`,
              name: 'Post',
            },
          },
          meta: {
            adoptsFrom: {
              module: `${baseRealm.url}catalog-entry`,
              name: 'CatalogEntry',
            },
          },
        },
      },
      'catalog-entry-2.json': {
        data: {
          type: 'card',
          attributes: {
            title: 'Article',
            description: 'A card that represents an online article ',
            ref: {
              module: `${testModuleRealm}article`,
              name: 'Article',
            },
          },
          meta: {
            adoptsFrom: {
              module: `${baseRealm.url}catalog-entry`,
              name: 'CatalogEntry',
            },
          },
        },
      },
      'mango.json': {
        data: {
          type: 'card',
          attributes: {
            firstName: 'Mango',
            numberOfTreats: ['one', 'two'],
          },
          meta: {
            adoptsFrom: {
              module: `${testModuleRealm}dog`,
              name: 'Dog',
            },
          },
        },
      },
      'ringo.json': {
        data: {
          type: 'card',
          attributes: {
            firstName: 'Ringo',
            numberOfTreats: ['three', 'five'],
          },
          meta: {
            adoptsFrom: {
              module: `${testModuleRealm}dog`,
              name: 'Dog',
            },
          },
        },
      },
      'vangogh.json': {
        data: {
          type: 'card',
          attributes: {
            firstName: 'Van Gogh',
            numberOfTreats: ['two', 'nine'],
          },
          meta: {
            adoptsFrom: {
              module: `${testModuleRealm}dog`,
              name: 'Dog',
            },
          },
        },
      },
      'friend1.json': {
        data: {
          type: 'card',
          attributes: {
            firstName: 'Hassan',
          },
          relationships: {
            friend: {
              links: {
                self: `${paths.url}friend2`,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: `${testModuleRealm}friend`,
              name: 'Friend',
            },
          },
        },
      },
      'friend2.json': {
        data: {
          type: 'card',
          attributes: {
            firstName: 'Mango',
          },
          relationships: {
            friend: {
              links: {
                self: null,
              },
            },
          },
          meta: {
            adoptsFrom: {
              module: `${testModuleRealm}friend`,
              name: 'Friend',
            },
          },
        },
      },
      'booking1.json': {
        data: {
          type: 'card',
          attributes: {
            hosts: [
              {
                firstName: 'Arthur',
              },
              {
                firstName: 'Ed',
                lastName: 'Faulkner',
              },
            ],
            sponsors: ['Sony', 'Nintendo'],
            posts: [
              {
                title: 'post 1',
                author: {
                  firstName: 'A',
                  posts: 10,
                },
                views: 16,
              },
            ],
          },
          relationships: {},
          meta: {
            adoptsFrom: {
              module: `${testModuleRealm}booking`,
              name: 'Booking',
            },
          },
        },
      },
      'booking2.json': {
        data: {
          type: 'card',
          attributes: {
            hosts: [
              {
                firstName: 'Arthur',
                lastName: 'Faulkner',
              },
            ],
            posts: [
              {
                title: 'post 1',
                author: {
                  firstName: 'A',
                  lastName: 'B',
                  posts: 5,
                },
                views: 10,
              },
              {
                title: 'post 2',
                author: {
                  firstName: 'C',
                  lastName: 'D',
                  posts: 11,
                },
                views: 13,
              },
              {
                title: 'post 2',
                author: {
                  firstName: 'C',
                  lastName: 'D',
                  posts: 2,
                },
                views: 0,
              },
            ],
          },
          relationships: {},
          meta: {
            adoptsFrom: {
              module: `${testModuleRealm}booking`,
              name: 'Booking',
            },
          },
        },
      },
    };

    let indexer: SearchIndex;

    hooks.beforeEach(async function () {
      let realm = await TestRealm.create(sampleCards, this.owner);
      await realm.ready;
      indexer = realm.searchIndex;
    });

    test(`can search for cards by using the 'eq' filter`, async function (assert) {
      let { data: matching } = await indexer.search({
        filter: {
          on: { module: `${testModuleRealm}post`, name: 'Post' },
          eq: { title: 'Card 1', description: 'Sample post' },
        },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [`${paths.url}card-1`, `${paths.url}cards/1`]
      );
    });

    test(`can use 'eq' to find 'null' values`, async function (assert) {
      let { data: matching } = await indexer.search({
        filter: {
          on: { module: `${testModuleRealm}book`, name: 'Book' },
          eq: { 'author.lastName': null },
        },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [`${testRealmURL}card-2`]
      );
    });

    test(`can search for cards by using a computed field`, async function (assert) {
      let { data: matching } = await indexer.search({
        filter: {
          on: { module: `${testModuleRealm}post`, name: 'Post' },
          eq: { 'author.fullName': 'Carl Stack' },
        },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [`${paths.url}cards/1`]
      );
    });

    test('can search for cards by using a linksTo field', async function (assert) {
      let { data: matching } = await indexer.search({
        filter: {
          on: { module: `${testModuleRealm}friend`, name: 'Friend' },
          eq: { 'friend.firstName': 'Mango' },
        },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [`${paths.url}friend1`]
      );
    });

    test(`can search for cards that have custom queryableValue`, async function (assert) {
      let { data: matching } = await indexer.search({
        filter: {
          on: { module: `${baseRealm.url}catalog-entry`, name: 'CatalogEntry' },
          eq: {
            ref: {
              module: `${testModuleRealm}post`,
              name: 'Post',
            },
          },
        },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [`${paths.url}catalog-entry-1`]
      );
    });

    test('can combine multiple filters', async function (assert) {
      let { data: matching } = await indexer.search({
        filter: {
          on: {
            module: `${testModuleRealm}post`,
            name: 'Post',
          },
          every: [
            { eq: { title: 'Card 1' } },
            { not: { eq: { 'author.firstName': 'Cardy' } } },
          ],
        },
      });
      assert.strictEqual(matching.length, 1);
      assert.strictEqual(matching[0]?.id, `${testRealmURL}cards/1`);
    });

    test('can handle a filter with double negatives', async function (assert) {
      let { data: matching } = await indexer.search({
        filter: {
          on: { module: `${testModuleRealm}post`, name: 'Post' },
          not: { not: { not: { eq: { 'author.firstName': 'Carl' } } } },
        },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [`${paths.url}card-1`]
      );
    });

    test('can filter by card type', async function (assert) {
      let { data: matching } = await indexer.search({
        filter: {
          type: { module: `${testModuleRealm}article`, name: 'Article' },
        },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [`${paths.url}card-1`, `${paths.url}cards/2`],
        'found cards of type Article'
      );

      matching = (
        await indexer.search({
          filter: { type: { module: `${testModuleRealm}post`, name: 'Post' } },
        })
      ).data;
      assert.deepEqual(
        matching.map((m) => m.id),
        [`${paths.url}card-1`, `${paths.url}cards/1`, `${paths.url}cards/2`],
        'found cards of type Post'
      );
    });

    test(`can filter on a card's own fields using range`, async function (assert) {
      let { data: matching } = await indexer.search({
        filter: {
          on: { module: `${testModuleRealm}post`, name: 'Post' },
          range: { views: { lte: 10, gt: 5 }, 'author.posts': { gte: 1 } },
        },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [`${paths.url}cards/1`]
      );
    });

    test(`can filter on a nested field inside a containsMany using 'range'`, async function (assert) {
      {
        let { data: matching } = await indexer.search({
          filter: {
            on: { module: `${testModuleRealm}booking`, name: 'Booking' },
            range: {
              'posts.views': { gt: 10, lte: 16 },
              'posts.author.posts': { gte: 5, lt: 10 },
            },
          },
        });
        assert.deepEqual(
          matching.map((m) => m.id),
          [`${paths.url}booking2`]
        );
      }
      {
        let { data: matching } = await indexer.search({
          filter: {
            on: { module: `${testModuleRealm}booking`, name: 'Booking' },
            range: {
              'posts.views': { lte: 0 },
            },
          },
        });
        assert.deepEqual(
          matching.map((m) => m.id),
          [`${paths.url}booking2`]
        );
      }
      {
        let { data: matching } = await indexer.search({
          filter: {
            on: { module: `${testModuleRealm}booking`, name: 'Booking' },
            range: {
              'posts.views': { lte: undefined },
            },
          },
        });
        assert.deepEqual(
          matching.map((m) => m.id),
          []
        );
      }
    });

    test('can use a range filter with custom queryableValue', async function (assert) {
      let { data: matching } = await indexer.search({
        filter: {
          on: { module: `${testModuleRealm}dog`, name: 'Dog' },
          range: {
            numberOfTreats: { lt: ['three', 'zero'], gt: ['two', 'zero'] },
          },
        },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [`${paths.url}vangogh`]
      );
    });

    test(`gives a good error when query refers to missing card`, async function (assert) {
      try {
        await indexer.search({
          filter: {
            on: {
              module: `${testModuleRealm}nonexistent`,
              name: 'Nonexistent',
            },
            eq: { nonExistentField: 'hello' },
          },
        });
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        assert.strictEqual(
          err.message,
          `Your filter refers to nonexistent type: import { Nonexistent } from "${testModuleRealm}nonexistent"`
        );
      }

      let cardRef: CardRef = {
        type: 'fieldOf',
        field: 'name',
        card: {
          module: `${testModuleRealm}nonexistent`,
          name: 'Nonexistent',
        },
      };
      try {
        await indexer.search({
          filter: {
            on: cardRef,
            eq: { name: 'Simba' },
          },
        });
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        assert.strictEqual(
          err.message,
          `Your filter refers to nonexistent type: ${JSON.stringify(
            cardRef,
            null,
            2
          )}`
        );
      }
    });

    test(`gives a good error when query refers to missing field`, async function (assert) {
      try {
        await indexer.search({
          filter: {
            on: { module: `${testModuleRealm}post`, name: 'Post' },
            eq: {
              'author.firstName': 'Cardy',
              'author.nonExistentField': 'hello',
            },
          },
        });
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        assert.strictEqual(
          err.message,
          `Your filter refers to nonexistent field "nonExistentField" on type {"module":"${testModuleRealm}person","name":"Person"}`
        );
      }
    });

    test(`can filter on a nested field using 'eq'`, async function (assert) {
      let { data: matching } = await indexer.search({
        filter: {
          on: { module: `${testModuleRealm}post`, name: 'Post' },
          eq: { 'author.firstName': 'Carl' },
        },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [`${paths.url}cards/1`, `${paths.url}cards/2`]
      );
    });

    test(`can filter on a nested field inside a containsMany using 'eq'`, async function (assert) {
      {
        let { data: matching } = await indexer.search({
          filter: {
            on: { module: `${testModuleRealm}booking`, name: 'Booking' },
            eq: { 'hosts.firstName': 'Arthur' },
          },
        });
        assert.deepEqual(
          matching.map((m) => m.id),
          [`${paths.url}booking1`, `${paths.url}booking2`],
          'eq on hosts.firstName'
        );
      }
      {
        let { data: matching } = await indexer.search({
          filter: {
            on: { module: `${testModuleRealm}booking`, name: 'Booking' },
            eq: { 'hosts.firstName': null },
          },
        });
        assert.strictEqual(matching.length, 0, 'eq on null hosts.firstName');
      }
      {
        let { data: matching } = await indexer.search({
          filter: {
            on: { module: `${testModuleRealm}booking`, name: 'Booking' },
            eq: { 'posts.author.firstName': 'A', 'posts.author.lastName': 'B' },
          },
        });
        assert.deepEqual(
          matching.map((m) => m.id),
          [`${paths.url}booking2`],
          'eq on posts.author.firstName and posts.author.lastName'
        );
      }
      {
        let { data: matching } = await indexer.search({
          filter: {
            on: { module: `${testModuleRealm}booking`, name: 'Booking' },
            eq: {
              'hosts.firstName': 'Arthur',
              'posts.author.lastName': null,
            },
          },
        });
        assert.deepEqual(
          matching.map((m) => m.id),
          [`${paths.url}booking1`],
          'eq on hosts.firstName, posts.author.firstName, and null posts.author.lastName'
        );
      }
    });

    skip(`can filter on an array of primitive fields inside a containsMany using 'eq'`, async function (assert) {
      {
        let { data: matching } = await indexer.search({
          filter: {
            on: { module: `${testModuleRealm}booking`, name: 'Booking' },
            eq: { sponsors: ['Nintendo'] },
          },
        });
        assert.deepEqual(
          matching.map((m) => m.id),
          [`${paths.url}booking1`],
          'eq on sponsors'
        );
      }
      {
        let { data: matching } = await indexer.search({
          filter: {
            on: { module: `${testModuleRealm}booking`, name: 'Booking' },
            eq: { sponsors: ['Playstation'] },
          },
        });
        assert.strictEqual(
          matching.length,
          0,
          'eq on nonexisting value in sponsors'
        );
      }
      {
        let { data: matching } = await indexer.search({
          filter: {
            on: { module: `${testModuleRealm}booking`, name: 'Booking' },
            eq: {
              'hosts.firstName': 'Arthur',
              sponsors: null,
            },
          },
        });
        assert.deepEqual(
          matching.map((m) => m.id),
          [`${paths.url}booking2`],
          'eq on hosts.firstName and null sponsors'
        );
      }
    });

    test('can negate a filter', async function (assert) {
      let { data: matching } = await indexer.search({
        filter: {
          on: { module: `${testModuleRealm}article`, name: 'Article' },
          not: { eq: { 'author.firstName': 'Carl' } },
        },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [`${testRealmURL}card-1`]
      );
    });

    test('can combine multiple types', async function (assert) {
      let { data: matching } = await indexer.search({
        filter: {
          any: [
            {
              on: { module: `${testModuleRealm}article`, name: 'Article' },
              eq: { 'author.firstName': 'Cardy' },
            },
            {
              on: { module: `${testModuleRealm}book`, name: 'Book' },
              eq: { 'author.firstName': 'Cardy' },
            },
          ],
        },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [`${paths.url}card-1`, `${paths.url}card-2`]
      );
    });

    // sorting
    test('can sort in alphabetical order', async function (assert) {
      let { data: matching } = await indexer.search({
        sort: [
          {
            by: 'author.lastName',
            on: { module: `${testModuleRealm}article`, name: 'Article' },
          },
        ],
        filter: {
          type: { module: `${testModuleRealm}article`, name: 'Article' },
        },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [`${paths.url}cards/2`, `${paths.url}card-1`]
      );
    });

    test('can sort in reverse alphabetical order', async function (assert) {
      let { data: matching } = await indexer.search({
        sort: [
          {
            by: 'author.firstName',
            on: { module: `${testModuleRealm}article`, name: 'Article' },
            direction: 'desc',
          },
        ],
        filter: { type: { module: `${testModuleRealm}post`, name: 'Post' } },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [
          `${paths.url}cards/1`, // type is post
          `${paths.url}cards/2`, // Carl
          `${paths.url}card-1`, // Cardy
        ]
      );
    });

    test('can sort by custom queryableValue', async function (assert) {
      let { data: matching } = await indexer.search({
        sort: [
          {
            by: 'numberOfTreats',
            on: { module: `${testModuleRealm}dog`, name: 'Dog' },
            direction: 'asc',
          },
        ],
        filter: { type: { module: `${testModuleRealm}dog`, name: 'Dog' } },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [
          `${paths.url}mango`, // 12
          `${paths.url}vangogh`, // 29
          `${paths.url}ringo`, // 35
        ]
      );
    });

    test('can sort by multiple string field conditions in given directions', async function (assert) {
      let { data: matching } = await indexer.search({
        sort: [
          {
            by: 'author.lastName',
            on: { module: `${testModuleRealm}book`, name: 'Book' },
            direction: 'asc',
          },
          {
            by: 'author.firstName',
            on: { module: `${testModuleRealm}book`, name: 'Book' },
            direction: 'desc',
          },
        ],
        filter: { type: { module: `${testModuleRealm}book`, name: 'Book' } },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [
          `${paths.url}books/2`, // Van Gogh Ab
          `${paths.url}books/1`, // Mango Ab
          `${paths.url}books/3`, // Jackie Ag
          `${paths.url}card-2`, // Cardy --> lastName is null
        ]
      );
    });

    test('can sort by integer value', async function (assert) {
      let { data: matching } = await indexer.search({
        sort: [
          {
            by: 'editions',
            on: { module: `${testModuleRealm}book`, name: 'Book' },
          },
          {
            by: 'author.lastName',
            on: { module: `${testModuleRealm}book`, name: 'Book' },
          },
        ],
        filter: { type: { module: `${testModuleRealm}book`, name: 'Book' } },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [
          `${paths.url}books/2`, // 0
          `${paths.url}books/1`, // 1
          `${paths.url}card-2`, // 1
          `${paths.url}books/3`, // 2
        ]
      );
    });

    test('can sort by date', async function (assert) {
      let { data: matching } = await indexer.search({
        sort: [
          {
            by: 'pubDate',
            on: { module: `${testModuleRealm}book`, name: 'Book' },
          },
        ],
        filter: { type: { module: `${testModuleRealm}book`, name: 'Book' } },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [
          `${paths.url}books/1`, // 2022-07-01
          `${paths.url}books/3`, // 2022-08-01
          `${paths.url}books/2`, // 2023-08-01
          `${paths.url}card-2`, // null
        ]
      );
    });

    test('can sort by mixed field types', async function (assert) {
      let { data: matching } = await indexer.search({
        sort: [
          {
            by: 'editions',
            on: { module: `${testModuleRealm}book`, name: 'Book' },
            direction: 'desc',
          },
          {
            by: 'author.lastName',
            on: { module: `${testModuleRealm}book`, name: 'Book' },
          },
        ],
        filter: { type: { module: `${testModuleRealm}book`, name: 'Book' } },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [
          `${paths.url}books/3`, // 2
          `${paths.url}books/1`, // 1 // Ab
          `${paths.url}card-2`, // 1 // null
          `${paths.url}books/2`, // 0
        ]
      );
    });

    test(`can sort on multiple paths in combination with 'any' filter`, async function (assert) {
      let { data: matching } = await indexer.search({
        sort: [
          {
            by: 'author.lastName',
            on: { module: `${testModuleRealm}book`, name: 'Book' },
          },
          {
            by: 'author.firstName',
            on: { module: `${testModuleRealm}book`, name: 'Book' },
            direction: 'desc',
          },
        ],
        filter: {
          any: [
            { type: { module: `${testModuleRealm}book`, name: 'Book' } },
            { type: { module: `${testModuleRealm}article`, name: 'Article' } },
          ],
        },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [
          `${paths.url}books/2`, // Ab Van Gogh
          `${paths.url}books/1`, // Ab Mango
          `${paths.url}books/3`, // Ag Jackie
          `${paths.url}card-2`, // null
          `${paths.url}card-1`, // (article)
          `${paths.url}cards/2`, // (article)
        ]
      );
    });

    test(`can sort on multiple paths in combination with 'every' filter`, async function (assert) {
      let { data: matching } = await indexer.search({
        sort: [
          {
            by: 'author.firstName',
            on: { module: `${testModuleRealm}book`, name: 'Book' },
            direction: 'desc',
          },
        ],
        filter: {
          every: [
            {
              on: { module: `${testModuleRealm}book`, name: 'Book' },
              not: { eq: { 'author.lastName': 'Aguilar' } },
            },
            {
              on: { module: `${testModuleRealm}book`, name: 'Book' },
              eq: { editions: 1 },
            },
          ],
        },
      });
      assert.deepEqual(
        matching.map((m) => m.id),
        [`${paths.url}books/1`]
      );
    });
  });
});
