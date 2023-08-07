import Component from '@glimmer/component';
import {
  Button,
  FieldContainer,
  BoxelInputValidationState,
  SearchInput,
  SearchInputBottomTreatment,
} from '@cardstack/boxel-ui';
import { on } from '@ember/modifier';
//@ts-ignore cached not available yet in definitely typed
import { cached, tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { action } from '@ember/object';
import SearchResult from './search-result';
import { Label } from '@cardstack/boxel-ui';
import { gt } from '../../helpers/truth-helpers';
import { service } from '@ember/service';
import { restartableTask } from 'ember-concurrency';
import OperatorModeStateService from '@cardstack/host/services/operator-mode-state-service';
import type CardService from '../../services/card-service';
import type LoaderService from '../../services/loader-service';
import { isSingleCardDocument } from '@cardstack/runtime-common';
import { Card } from 'https://cardstack.com/base/card-api';

export enum SearchSheetMode {
  Closed = 'closed',
  ChoosePrompt = 'choose-prompt',
  ChooseResults = 'choose-results',
  SearchPrompt = 'search-prompt',
  SearchResults = 'search-results',
}

interface Signature {
  Element: HTMLElement;
  Args: {
    mode: SearchSheetMode;
    onCancel: () => void;
    onFocus: () => void;
    onCardSelect: (card: Card) => void;
  };
  Blocks: {};
}

export default class SearchSheet extends Component<Signature> {
  @tracked searchInputValue = '';
  @tracked cardURL = '';
  @tracked hasCardURLError = false;
  @service declare operatorModeStateService: OperatorModeStateService;
  @service declare cardService: CardService;
  @service declare loaderService: LoaderService;

  get inputBottomTreatment() {
    return this.args.mode == SearchSheetMode.Closed
      ? SearchInputBottomTreatment.Flat
      : SearchInputBottomTreatment.Rounded;
  }

  get sheetSize() {
    switch (this.args.mode) {
      case SearchSheetMode.Closed:
        return 'closed';
      case SearchSheetMode.ChoosePrompt:
      case SearchSheetMode.SearchPrompt:
        return 'prompt';
      case SearchSheetMode.ChooseResults:
      case SearchSheetMode.SearchResults:
        return 'results';
    }
  }

  get isGoDisabled() {
    // TODO after we have ember concurrency task for search implemented,
    // make sure to also include the task.isRunning as criteria for
    // disabling the go button
    return (!this.searchInputValue && !this.cardURL) || this.getCard.isRunning;
  }

  get cardURLFieldState() {
    return this.hasCardURLError ? 'invalid' : 'initial';
  }

  get cardURLErrorMessage() {
    return this.hasCardURLError ? 'Not a valid Card URL' : undefined;
  }

  // This funky little gymnastics has the effect of leaving the headline along when closing the sheet, to improve the animation
  _headline = 'Search cards and workspaces';
  get headline() {
    let mode = this.args.mode;
    if (
      mode == SearchSheetMode.ChoosePrompt ||
      mode == SearchSheetMode.ChooseResults
    ) {
      this._headline = 'Open a card or workspace';
    } else if (
      mode == SearchSheetMode.SearchPrompt ||
      mode == SearchSheetMode.SearchResults
    ) {
      this._headline = 'Search cards and workspaces';
    }
    return this._headline;
  }

  getCard = restartableTask(async (cardURL: string) => {
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
        this.operatorModeStateService.addItemToStack({
          type: 'card',
          card,
          format: 'isolated',
          stackIndex: 0,
        });
        this.resetState();
        this.args.onCancel();
        return;
      }
    }
    this.hasCardURLError = true;
  });

  @action
  onCancel() {
    this.resetState();
    this.args.onCancel();
  }

  @action
  setCardURL(cardURL: string) {
    this.hasCardURLError = false;
    this.cardURL = cardURL;
  }

  @action
  onURLFieldKeypress(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      this.getCard.perform(this.cardURL);
    }
  }

  @action
  onGo() {
    // load card if URL field is populated, otherwise perform search if search term specified
    if (this.cardURL) {
      this.getCard.perform(this.cardURL);
    }
  }

  resetState() {
    this.searchInputValue = '';
    this.cardURL = '';
    this.hasCardURLError = false;
  }

  @cached
  get orderedRecentCards() {
    // Most recently added first
    return [...this.operatorModeStateService.recentCards].reverse();
  }

  <template>
    <div class='search-sheet {{this.sheetSize}}' data-test-search-sheet>
      <div class='header'>
        <div class='headline'>
          {{this.headline}}
        </div>
        <div class='controls'>
          {{! Controls here }}
        </div>
      </div>
      <SearchInput
        @bottomTreatment={{this.inputBottomTreatment}}
        @value={{this.searchInputValue}}
        @placeholder='Enter search term or type a command'
        @onFocus={{@onFocus}}
        @onInput={{fn (mut this.searchInputValue)}}
      />
      <div class='search-sheet-content'>
        {{#if (gt this.operatorModeStateService.recentCards.length 0)}}
          <div class='search-sheet-content__recent-access'>
            <Label>Recent</Label>
            <div class='search-sheet-content__recent-access__body'>
              <div class='search-sheet-content__recent-access__cards'>
                {{#each this.orderedRecentCards as |card i|}}
                  <SearchResult
                    @card={{card}}
                    {{on 'click' (fn @onCardSelect card)}}
                    data-test-search-result-index={{i}}
                  />
                {{/each}}
              </div>
            </div>
          </div>
        {{/if}}
      </div>
      <div class='footer'>
        <div class='url-entry'>
          <FieldContainer @label='Enter Card URL:' @horizontalLabelSize='small'>
            <BoxelInputValidationState
              data-test-url-field
              @placeholder='http://'
              @value={{this.cardURL}}
              @onInput={{this.setCardURL}}
              @onKeyPress={{this.onURLFieldKeypress}}
              @state={{this.cardURLFieldState}}
              @errorMessage={{this.cardURLErrorMessage}}
            />
          </FieldContainer>
        </div>
        <div class='buttons'>
          <Button
            {{on 'click' this.onCancel}}
            data-test-search-sheet-cancel-button
          >Cancel</Button>
          <Button
            data-test-go-button
            @disabled={{this.isGoDisabled}}
            @kind='primary'
            {{on 'click' this.onGo}}
          >Go</Button>
        </div>
      </div>
    </div>
    <style>
      :global(:root) {
        --search-sheet-closed-height: 59px;
      }

      .search-sheet {
        background-color: var(--boxel-light);
        border-radius: var(--boxel-border-radius-xl)
          var(--boxel-border-radius-xl) 0 0;
        bottom: -1px;
        box-shadow: 0 5px 15px 0 rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        left: 3.5%;
        position: absolute;
        transition:
          height var(--boxel-transition),
          padding var(--boxel-transition);
        width: 93%;
      }

      .search-sheet:not(.closed) {
        gap: var(--boxel-sp);
      }

      .closed {
        height: var(--search-sheet-closed-height);
        padding: 0;
      }

      .prompt {
        padding: 30px 40px;
      }

      .results {
        height: 300px;
        padding: 30px 40px;
      }

      .header,
      .footer {
        align-items: center;
        display: flex;
        flex: 1;
        justify-content: space-between;
        opacity: 1;
        transition:
          flex var(--boxel-transition),
          opacity var(--boxel-transition);
      }

      .closed .header,
      .closed .footer {
        flex: 0;
        opacity: 0;
      }

      .header {
        height: 37px;
        overflow: hidden;
      }

      .headline {
        font-family: Poppins;
        font-size: 22px;
        font-weight: bold;
        font-stretch: normal;
        font-style: normal;
        line-height: 0.91;
        letter-spacing: 0.22px;
        color: #000;
      }

      .footer {
        height: 40px;
        overflow: hidden;
      }

      .search-sheet-content {
        display: flex;
        flex-direction: column;
      }
      .search-sheet-content__recent-access {
        display: flex;
        flex-direction: column;
        width: 100%;
      }
      .search-sheet-content__recent-access .boxel-label {
        font: 700 var(--boxel-font);
      }
      .search-sheet-content__recent-access__body {
        overflow: auto;
      }
      .search-sheet-content__recent-access__cards {
        display: flex;
        flex-direction: row;
        width: min-content;
        padding: var(--boxel-sp) var(--boxel-sp-xxxs);
        gap: var(--boxel-sp);
      }

      .url-entry {
        flex: 2;
        margin-right: var(--boxel-sp);
      }

      .input {
        transition: margin var(--boxel-transition);
      }

      .search-sheet .input {
        margin: var(--boxel-sp-lg) 0 var(--boxel-sp);
      }

      .search-sheet.closed .input {
        margin: 0;
      }
    </style>
  </template>
}
