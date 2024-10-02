import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { service } from '@ember/service';
import Component from '@glimmer/component';

import { BoxelButton } from '@cardstack/boxel-ui/components';
import { eq, gt } from '@cardstack/boxel-ui/helpers';

import { ArrowLeft, ArrowRight } from '@cardstack/boxel-ui/icons';

import type { StackItem } from '@cardstack/host/lib/stack-item';

import type { CardDef } from 'https://cardstack.com/base/card-api';

import type CardService from '../../services/card-service';
import type LoaderService from '../../services/loader-service';
import type OperatorModeStateService from '../../services/operator-mode-state-service';

interface Signature {
  Args: {
    selectedCards: CardDef[][]; // the selected cards for each stack
    copy: (
      sources: CardDef[],
      sourceItem: StackItem,
      destinationItem: StackItem,
    ) => void;
    isCopying: boolean;
  };
}

const LEFT = 0;
const RIGHT = 1;

export default class CopyButton extends Component<Signature> {
  @service declare loaderService: LoaderService;
  @service declare cardService: CardService;
  @service declare operatorModeStateService: OperatorModeStateService;

  <template>
    {{#if (gt this.stacks.length 1)}}
      {{#if this.state}}
        <BoxelButton
          class='copy-button'
          @kind={{this.buttonKind}}
          @loading={{@isCopying}}
          @size='tall'
          {{on
            'click'
            (fn
              @copy
              this.state.sources
              this.state.sourceItem
              this.state.destinationItem
            )
          }}
          data-test-copy-button={{this.state.direction}}
        >
          {{#if @isCopying}}
            <span class='copy-text'>
              Copying
              {{this.state.sources.length}}
              {{#if (gt this.state.sources.length 1)}}
                Cards
              {{else}}
                Card
              {{/if}}
            </span>
          {{else}}
            {{#if (eq this.state.direction 'left')}}
              <ArrowLeft class='arrow-icon' width='18px' height='18px' />
            {{/if}}
            <span class='copy-text'>
              Copy
              {{this.state.sources.length}}
              {{#if (gt this.state.sources.length 1)}}
                Cards
              {{else}}
                Card
              {{/if}}
            </span>
            {{#if (eq this.state.direction 'right')}}
              <ArrowRight class='arrow-icon' width='18px' height='18px' />
            {{/if}}
          {{/if}}
        </BoxelButton>
      {{/if}}
    {{/if}}
    <style scoped>
      .copy-button {
        position: absolute;
        left: calc(50% - var(--boxel-button-min-width, 5rem));
        color: white;
        box-shadow: 0 15px 30px 0 rgba(0, 0, 0, 0.5);
        border: solid 1px rgba(255, 255, 255, 0.25);
      }
      .copy-text {
        margin: 0 var(--boxel-sp-xxs);
      }
      .arrow-icon {
        --icon-color: var(--boxel-light);
      }
    </style>
  </template>

  get stacks() {
    return this.operatorModeStateService.state?.stacks ?? [];
  }

  get buttonKind() {
    return this.args.isCopying ? 'primary-dark' : 'primary';
  }

  get state() {
    // Need to have 2 stacks in order for a copy button to exist
    if (this.stacks.length < 2) {
      return undefined;
    }

    let topMostStackItems = this.operatorModeStateService.topMostStackItems();
    let indexCardIndicies = topMostStackItems.reduce(
      (indexCards, item, index) => {
        if (!item?.card) {
          return indexCards;
        }
        let realmURL = item.card[item.api.realmURL];
        if (!realmURL) {
          throw new Error(
            `could not determine realm URL for card ${item.card.id}`,
          );
        }
        if (item.card.id === `${realmURL.href}index`) {
          return [...indexCards, index];
        }
        return indexCards;
      },
      [] as number[],
    );

    switch (indexCardIndicies.length) {
      case 0:
        // at least one of the top most cards needs to be an index card
        return undefined;

      case 1:
        // if only one of the top most cards are index cards, and the index card
        // has no selections, then the copy state reflects the copy of the top most
        // card to the index card
        if (this.args.selectedCards[indexCardIndicies[0]].length) {
          // the index card should be the destination card--if it has any
          // selections then don't show the copy button
          return undefined;
        }
        // eslint-disable-next-line no-case-declarations
        let sourceItem =
          topMostStackItems[indexCardIndicies[0] === LEFT ? RIGHT : LEFT];
        return {
          direction: indexCardIndicies[0] === LEFT ? 'left' : 'right',
          sources: [sourceItem.card],
          destinationItem: topMostStackItems[indexCardIndicies[0]] as StackItem, // the index card is never a contained card
          sourceItem,
        };

      case 2: {
        if (
          topMostStackItems[LEFT].card.id === topMostStackItems[RIGHT].card.id
        ) {
          // the source and destination cannot be the same
          return undefined;
        }
        // if both the top most cards are index cards, then we need to analyze
        // the selected cards from both stacks in order to determine copy button state
        let sourceStack: number | undefined;
        for (let [
          index,
          stackSelections,
        ] of this.args.selectedCards.entries()) {
          // both stacks have selections--in this case don't show a copy button
          if (stackSelections.length > 0 && sourceStack != null) {
            return undefined;
          }
          if (stackSelections.length > 0) {
            sourceStack = index;
          }
        }
        // no stacks have a selection
        if (sourceStack == null) {
          return undefined;
        }
        let sourceItem =
          sourceStack === LEFT
            ? (topMostStackItems[LEFT] as StackItem)
            : (topMostStackItems[RIGHT] as StackItem); // the index card is never a contained card
        let destinationItem =
          sourceStack === LEFT
            ? (topMostStackItems[RIGHT] as StackItem)
            : (topMostStackItems[LEFT] as StackItem); // the index card is never a contained card

        // if the source and destination are the same, don't show a copy button
        if (sourceItem.card.id === destinationItem.card.id) {
          return undefined;
        }

        return {
          direction: sourceStack === LEFT ? 'right' : 'left',
          sources: this.args.selectedCards[sourceStack],
          sourceItem,
          destinationItem,
        };
      }
      default:
        throw new Error(
          `Don't know how to handle copy state for ${this.stacks.length} stacks`,
        );
    }
  }
}
