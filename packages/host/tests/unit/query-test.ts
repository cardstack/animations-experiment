import { module, test, skip } from 'qunit';

import {
  Loader,
  VirtualNetwork,
  baseRealm,
  IndexerDBClient,
} from '@cardstack/runtime-common';

import ENV from '@cardstack/host/config/environment';
import SQLiteAdapter from '@cardstack/host/lib/SQLiteAdapter';
import { shimExternals } from '@cardstack/host/lib/externals';

import { CardDef } from 'https://cardstack.com/base/card-api';

import { testRealmURL, setupIndex, serializeCard } from '../helpers';

let cardApi: typeof import('https://cardstack.com/base/card-api');
let string: typeof import('https://cardstack.com/base/string');
let { sqlSchema, resolvedBaseRealmURL } = ENV;

module('Unit | query', function (hooks) {
  let adapter: SQLiteAdapter;
  let client: IndexerDBClient;
  let loader: Loader;
  let testCards: { [name: string]: CardDef } = {};

  hooks.beforeEach(async function () {
    let virtualNetwork = new VirtualNetwork();
    loader = virtualNetwork.createLoader();
    loader.addURLMapping(new URL(baseRealm.url), new URL(resolvedBaseRealmURL));
    shimExternals(virtualNetwork);

    cardApi = await loader.import(`${baseRealm.url}card-api`);
    string = await loader.import(`${baseRealm.url}string`);

    let { field, contains, CardDef } = cardApi;
    let { default: StringField } = string;
    class Person extends CardDef {
      @field name = contains(StringField);
    }
    class FancyPerson extends Person {
      @field favoriteColor = contains(StringField);
    }
    class Cat extends CardDef {
      @field name = contains(StringField);
    }

    loader.shimModule(`${testRealmURL}person`, { Person });
    loader.shimModule(`${testRealmURL}fancy-person`, { FancyPerson });
    loader.shimModule(`${testRealmURL}cat`, { Cat });

    let mango = new FancyPerson({ id: `${testRealmURL}mango`, name: 'Mango' });
    let vangogh = new Person({
      id: `${testRealmURL}vangogh`,
      name: 'Van Gogh',
    });
    let paper = new Cat({ id: `${testRealmURL}paper`, name: 'Paper' });
    testCards = {
      mango,
      vangogh,
      paper,
    };

    adapter = new SQLiteAdapter(sqlSchema);
    client = new IndexerDBClient(adapter);
    await client.ready();
  });

  hooks.afterEach(async function () {
    await client.teardown();
  });

  test('can get all cards with empty filter', async function (assert) {
    let { mango, vangogh, paper } = testCards;
    await setupIndex(client, [mango, vangogh, paper]);

    let { cards, meta } = await client.search({}, loader);
    assert.strictEqual(meta.page.total, 3, 'the total results meta is correct');
    assert.deepEqual(
      cards,
      [
        await serializeCard(mango),
        await serializeCard(paper),
        await serializeCard(vangogh),
      ],
      'results are correct',
    );
  });

  test('can filter by type', async function (assert) {
    let { mango, vangogh, paper } = testCards;
    await setupIndex(client, [mango, vangogh, paper]);

    let { cards, meta } = await client.search(
      {
        filter: {
          type: { module: `${testRealmURL}person`, name: 'Person' },
        },
      },
      loader,
    );

    assert.strictEqual(meta.page.total, 2, 'the total results meta is correct');
    assert.deepEqual(
      cards,
      [await serializeCard(mango), await serializeCard(vangogh)],
      'results are correct',
    );
  });

  test(`can filter using 'eq'`, async function (assert) {
    let { mango, vangogh, paper } = testCards;
    await setupIndex(client, [
      { card: mango, data: { search_doc: { name: 'Mango' } } },
      { card: vangogh, data: { search_doc: { name: 'Van Gogh' } } },
      // this card's "name" field doesn't match our filter since our filter
      // specified "name" fields of Person cards
      { card: paper, data: { search_doc: { name: 'Mango' } } },
    ]);

    let { cards, meta } = await client.search(
      {
        filter: {
          eq: { name: 'Mango' },
          on: { module: `${testRealmURL}person`, name: 'Person' },
        },
      },
      loader,
    );

    assert.strictEqual(meta.page.total, 1, 'the total results meta is correct');
    assert.deepEqual(
      cards,
      [await serializeCard(mango)],
      'results are correct',
    );
  });

  skip(`can filter using 'eq' thru nested fields`);
  skip(`can leverage queryableValue hook in card definition`);
});
