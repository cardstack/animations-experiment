import { registerDestructor } from '@ember/destroyable';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { action } from '@ember/object';
import type Owner from '@ember/owner';
import { service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import { restartableTask, task } from 'ember-concurrency';
import debounce from 'lodash/debounce';

import { TrackedArray, TrackedObject } from 'tracked-built-ins';

import { Button, BoxelInput } from '@cardstack/boxel-ui/components';
import { and, eq, gt, not } from '@cardstack/boxel-ui/helpers';
import { IconPlus } from '@cardstack/boxel-ui/icons';

import {
  createNewCard,
  baseRealm,
  isSingleCardDocument,
  type CodeRef,
  type CreateNewCard,
  Deferred,
  type RealmInfo,
} from '@cardstack/runtime-common';

import type { Query, Filter } from '@cardstack/runtime-common/query';

import type { CardDef, CardContext } from 'https://cardstack.com/base/card-api';

import { getSearchResults, Search } from '../../resources/search';

import {
  suggestCardChooserTitle,
  getSuggestionWithLowestDepth,
} from '../../utils/text-suggestion';

import ModalContainer from '../modal-container';

import UrlSearch from '../url-search';

import CardCatalogFilters from './filters';

import CardCatalog from './index';

import type CardService from '../../services/card-service';
import type LoaderService from '../../services/loader-service';

interface Signature {
  Args: {
    context?: CardContext;
  };
}

export interface RealmCards {
  url: string | null;
  realmInfo: RealmInfo;
  cards: CardDef[];
}

type Request = {
  search: Search;
  deferred: Deferred<CardDef | undefined>;
  opts?: {
    offerToCreate?: { ref: CodeRef; relativeTo: URL | undefined };
    createNewCard?: CreateNewCard;
  };
};

type State = {
  id: number;
  request: Request;
  selectedCard?: CardDef;
  selectedRealms: RealmCards[];
  searchKey: string;
  searchResults: RealmCards[];
  cardURL: string;
  chooseCardTitle: string;
  dismissModal: boolean;
};

const DEFAULT_CHOOOSE_CARD_TITLE = 'Choose a Card';

export default class CardCatalogModal extends Component<Signature> {
  <template>
    {{#if (and (gt this.stateStack.length 0) (not this.state.dismissModal))}}
      <ModalContainer
        @title={{this.state.chooseCardTitle}}
        @onClose={{fn this.pick undefined}}
        @zIndex={{this.zIndex}}
        data-test-card-catalog-modal
      >
        <:header>
          <BoxelInput
            @type='search'
            @variant='large'
            @value={{this.state.searchKey}}
            @onInput={{this.setSearchKey}}
            @onKeyPress={{this.onSearchFieldKeypress}}
            @hasValidation={{true}}
            @state={{this.cardURLFieldState}}
            @errorMessage={{this.cardURLErrorMessage}}
            @placeholder='Search for a card'
            data-test-search-field
          />
          <CardCatalogFilters
            @availableRealms={{this.availableRealms}}
            @selectedRealms={{this.state.selectedRealms}}
            @onSelectRealm={{this.onSelectRealm}}
            @onDeselectRealm={{this.onDeselectRealm}}
          />
        </:header>
        <:content>
          {{#if this.state.request.search.isLoading}}
            Loading...
          {{else}}
            {{! The getter for availableRealms is necessary because
                it's a resource that needs to load the search results }}
            <CardCatalog
              @results={{if
                this.availableRealms.length
                this.state.searchResults
                this.availableRealms
              }}
              @toggleSelect={{this.toggleSelect}}
              @selectedCard={{this.state.selectedCard}}
              @context={{@context}}
            />
          {{/if}}
        </:content>
        <:footer>
          <div class='footer'>
            <div class='footer__actions-left'>
              {{#if this.state.request.opts.offerToCreate}}
                <Button
                  @kind='secondary-light'
                  @size='tall'
                  class='create-new-button'
                  {{on
                    'click'
                    (fn
                      this.createNew
                      this.state.request.opts.offerToCreate.ref
                      this.state.request.opts.offerToCreate.relativeTo
                    )
                  }}
                  data-test-card-catalog-create-new-button
                >
                  <IconPlus width='20' height='20' role='presentation' />
                  Create New
                  {{this.cardRefName}}
                </Button>
              {{/if}}
              <UrlSearch
                @cardURL={{this.state.cardURL}}
                @setCardURL={{this.setCardURL}}
                @setSelectedCard={{this.setSelectedCard}}
              />
            </div>
            <div>
              <Button
                @kind='secondary-light'
                @size='tall'
                class='footer-button'
                {{on 'click' (fn this.pick undefined undefined)}}
                data-test-card-catalog-cancel-button
              >
                Cancel
              </Button>
              <Button
                @kind='primary'
                @size='tall'
                @disabled={{eq this.state.selectedCard undefined}}
                class='footer-button'
                {{on 'click' (fn this.pick this.state.selectedCard undefined)}}
                data-test-card-catalog-go-button
              >
                Go
              </Button>
            </div>
          </div>
        </:footer>
      </ModalContainer>
    {{/if}}
    <style>
      .footer {
        display: flex;
        justify-content: space-between;
        gap: var(--boxel-sp);
      }
      .footer__actions-left {
        display: flex;
        gap: var(--boxel-sp);
        flex-grow: 1;
      }
      .footer-button + .footer-button {
        margin-left: var(--boxel-sp-xs);
      }
      .create-new-button {
        --icon-color: var(--boxel-highlight);
        display: flex;
        justify-content: center;
        align-items: center;
        gap: var(--boxel-sp-xxs);
      }
    </style>
  </template>

  stateStack: State[] = new TrackedArray<State>();
  stateId = 0;
  @tracked zIndex = 20;
  @service declare cardService: CardService;
  @service declare loaderService: LoaderService;

  @tracked hasCardURLError = false;

  constructor(owner: Owner, args: {}) {
    super(owner, args);
    (globalThis as any)._CARDSTACK_CARD_CHOOSER = this;
    registerDestructor(this, () => {
      delete (globalThis as any)._CARDSTACK_CARD_CHOOSER;
    });
  }

  get cardRefName() {
    return (
      (
        this.state.request.opts?.offerToCreate?.ref as {
          module: string;
          name: string;
        }
      ).name ?? 'Card'
    );
  }
  get searchKeyIsURL() {
    try {
      new URL(this.state.searchKey);
      return true;
    } catch (_e) {
      return false;
    }
  }

  // FIXME copied from SearchSheet
  getCard = restartableTask(async (cardURL: string) => {
    if (this.searchKeyIsURL) {
      this.hasCardURLError = false;
      let response = await this.loaderService.loader.fetch(cardURL, {
        headers: {
          Accept: 'application/vnd.card+json',
        },
      });

      if (response.ok) {
        let maybeCardDoc = await response.json();
        if (isSingleCardDocument(maybeCardDoc)) {
          let card = await this.cardService.createFromSerialized(
            maybeCardDoc.data,
            maybeCardDoc,
            new URL(maybeCardDoc.data.id),
          );
          this.setSelectedCard(card);
        }
      }

      this.hasCardURLError = true;
    }
  });

  get displayErrorState() {
    return this.hasCardURLError;
  }

  get cardURLErrorMessage() {
    return this.displayErrorState ? 'Not a valid Card URL' : undefined;
  }

  get cardURLFieldState(): InputValidationState {
    return this.displayErrorState ? 'invalid' : 'initial';
  }

  get availableRealms(): RealmCards[] {
    // returns all available realms and their cards that match a certain type criteria
    // realm filters and search key filter these groups of cards
    // filters dropdown menu will always display all available realms
    if (this.state.request.search.instancesByRealm.length) {
      this.state.searchResults = this.state.request.search.instancesByRealm;
    }
    return this.state.request.search.instancesByRealm ?? [];
  }

  get displayedRealms(): RealmCards[] {
    // filters the available realm cards by selected realms
    return this.state.selectedRealms.length
      ? this.state.selectedRealms
      : this.availableRealms;
  }

  get state(): State {
    return this.stateStack[this.stateStack.length - 1];
  }

  @action onSelectRealm(realm: RealmCards) {
    this.state.selectedRealms.push(realm);
    this.onSearchFieldUpdated();
  }

  @action onDeselectRealm(realm: RealmCards) {
    let selectedRealmIndex = this.state.selectedRealms.findIndex(
      (r) => r.url === realm.url,
    );
    this.state.selectedRealms.splice(selectedRealmIndex, 1);
    this.onSearchFieldUpdated();
  }

  private resetState() {
    this.state.searchKey = '';
    this.state.searchResults = this.availableRealms;
    this.state.cardURL = '';
    this.state.selectedCard = undefined;
    this.state.dismissModal = false;
  }

  // This is part of our public API for runtime-common to invoke the card chooser
  async chooseCard<T extends CardDef>(
    query: Query,
    opts?: {
      offerToCreate?: { ref: CodeRef; relativeTo: URL | undefined };
      multiSelect?: boolean;
      createNewCard?: CreateNewCard;
    },
  ): Promise<undefined | T> {
    this.zIndex++;
    return (await this._chooseCard.perform(
      {
        // default to title sort so that we can maintain stability in
        // the ordering of the search results (server sorts results
        // by order indexed by default)
        sort: [
          {
            on: {
              module: `${baseRealm.url}card-api`,
              name: 'CardDef',
            },
            by: 'title',
          },
        ],
        ...query,
      },
      opts,
    )) as T | undefined;
  }

  private _chooseCard = task(
    async <T extends CardDef>(
      query: Query,
      opts: {
        offerToCreate?: { ref: CodeRef; relativeTo: URL | undefined };
        multiSelect?: boolean;
      } = {},
    ) => {
      this.stateId++;
      let title = chooseCardTitle(query.filter, opts?.multiSelect);
      let request = new TrackedObject<Request>({
        search: getSearchResults(this, () => query),
        deferred: new Deferred(),
        opts,
      });
      let cardCatalogState = new TrackedObject<State>({
        id: this.stateId,
        request,
        chooseCardTitle: title,
        searchKey: '',
        cardURL: '',
        searchResults: new TrackedArray<RealmCards>([]),
        selectedRealms: new TrackedArray<RealmCards>([]),
        dismissModal: false,
      });
      this.stateStack.push(cardCatalogState);

      let card = await request.deferred.promise;
      if (card) {
        return card as T;
      } else {
        return undefined;
      }
    },
  );

  @action
  setSearchKey(searchKey: string) {
    this.state.searchKey = searchKey;
    if (!this.state.searchKey) {
      this.resetState();
    } else {
      this.debouncedSearchFieldUpdate();
    }
  }

  debouncedSearchFieldUpdate = debounce(() => this.onSearchFieldUpdated(), 500);

  @action setCardURL(cardURL: string) {
    this.state.selectedCard = undefined;
    this.state.cardURL = cardURL;
  }

  @action setSelectedCard(card: CardDef | undefined) {
    this.state.selectedCard = card;
  }

  @action
  onSearchFieldKeypress(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      this.onSearchFieldUpdated();
    }
  }

  @action
  onSearchFieldUpdated() {
    if (!this.state.searchKey && !this.state.selectedRealms.length) {
      return this.resetState();
    }

    if (this.searchKeyIsURL) {
      this.getCard.perform(this.state.searchKey);
    } else {
      let results: RealmCards[] = [];
      for (let { url, realmInfo, cards } of this.displayedRealms) {
        let filteredCards = cards.filter((c) => {
          return c.title
            ?.trim()
            .toLowerCase()
            .includes(this.state.searchKey.trim().toLowerCase());
        });
        if (filteredCards.length) {
          results.push({
            url,
            realmInfo,
            cards: filteredCards,
          });
        }
      }
      this.state.searchResults = results;
    }
  }

  @action toggleSelect(card?: CardDef): void {
    this.state.cardURL = '';
    if (this.state.selectedCard?.id === card?.id) {
      this.state.selectedCard = undefined;
      return;
    }
    this.state.selectedCard = card;
  }

  @action pick(card?: CardDef, state?: State) {
    let request = state ? state.request : this.state.request;
    if (request) {
      request.deferred.fulfill(card);
    }

    // In the 'createNewCard' case, auto-save doesn't follow any specific order,
    // so we cannot guarantee that the outer 'createNewCard' process (the top item in the stack) will be saved before the inner one.
    // That's why we use state ID to remove state from the stack.
    if (state) {
      let stateIndex = this.stateStack.findIndex((s) => s.id === state.id);
      this.stateStack.splice(stateIndex, 1);
    } else {
      this.stateStack.pop();
    }
  }

  @action createNew(ref: CodeRef, relativeTo: URL | undefined) {
    this.createNewTask.perform(ref, relativeTo);
  }

  createNewTask = task(
    async (
      ref: CodeRef,
      relativeTo: URL | undefined /* this should be the catalog entry ID */,
    ) => {
      let newCard;
      this.state.dismissModal = true;

      // We need to store the current state in a variable
      // because there is a possibility that in createNewCard,
      // users will open the card catalog modal and insert a new state into the stack.
      let currentState = this.state;
      if (this.state.request.opts?.createNewCard) {
        newCard = await this.state.request.opts?.createNewCard(
          ref,
          relativeTo,
          {
            isLinkedCard: true,
          },
        );
      } else {
        newCard = await createNewCard(ref, relativeTo);
      }
      this.pick(newCard, currentState);
    },
  );
}

function chooseCardTitle(
  filter: Filter | undefined,
  multiSelect?: boolean,
): string {
  if (!filter) {
    return DEFAULT_CHOOOSE_CARD_TITLE;
  }
  let suggestions = suggestCardChooserTitle(filter, 0, { multiSelect });
  return (
    getSuggestionWithLowestDepth(suggestions) ?? DEFAULT_CHOOOSE_CARD_TITLE
  );
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'CardCatalog::Modal': typeof CardCatalogModal;
  }
}
