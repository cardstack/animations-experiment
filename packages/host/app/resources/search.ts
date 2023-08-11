import { Resource } from 'ember-resources';
import { restartableTask } from 'ember-concurrency';
import { tracked } from '@glimmer/tracking';
import { baseRealm } from '@cardstack/runtime-common';
import { service } from '@ember/service';
import flatMap from 'lodash/flatMap';
import ENV from '@cardstack/host/config/environment';
import type CardService from '../services/card-service';
import type { Query } from '@cardstack/runtime-common/query';
import type { Card } from 'https://cardstack.com/base/card-api';
import { type RealmCards } from '../components/card-catalog-modal';

interface Args {
  named: {
    query: Query;
    realms?: string[];
  };
}

// This is temporary until we have a better way of discovering the realms that
// are available for a user to search from
const { otherRealmURLs } = ENV;

export class Search extends Resource<Args> {
  @tracked instances: Card[] = [];
  @tracked instancesByRealm: RealmCards[] = [];
  @service declare cardService: CardService;

  modify(_positional: never[], named: Args['named']) {
    let { query, realms } = named;
    this.search.perform(query, realms);
  }

  private search = restartableTask(async (query: Query, realms?: string[]) => {
    // until we have realm index rollup, search all the realms as separate
    // queries that we merge together
    let realmsToSearch = realms ?? [
      ...new Set(
        realms ?? [
          this.cardService.defaultURL.href,
          baseRealm.url,
          ...otherRealmURLs,
        ],
      ),
    ];
    this.instances = flatMap(
      await Promise.all(
        // use a Set since the default URL may actually be the base realm
        realmsToSearch.map(
          async (realm) => await this.cardService.search(query, new URL(realm)),
        ),
      ),
    );

    let realmsWithCards = realmsToSearch
      .map((url) => {
        let cards = this.instances.filter((card) => card.id.startsWith(url));
        return { url, cards };
      })
      .filter((r) => r.cards.length > 0);

    this.instancesByRealm = await Promise.all(
      realmsWithCards.map(async ({ url, cards }) => {
        let realmInfo = await this.cardService.getRealmInfo(cards[0]);
        if (!realmInfo) {
          throw new Error(`Could not find realm info for card ${cards[0].id}`);
        }
        return { url, realmInfo, cards };
      }),
    );
  });

  get isLoading() {
    return this.search.isRunning;
  }
}

export function getSearchResults(
  parent: object,
  query: () => Query,
  realms?: () => string[],
) {
  return Search.from(parent, () => ({
    named: {
      query: query(),
      realms: realms ? realms() : undefined,
    },
  })) as Search;
}
