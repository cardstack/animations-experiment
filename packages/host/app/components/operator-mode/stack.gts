import Component from '@glimmer/component';

import { task } from 'ember-concurrency';
import perform from 'ember-concurrency/helpers/perform';

import type { Actions } from '@cardstack/runtime-common';

import type { StackItem } from '@cardstack/host/lib/stack-item';

import OperatorModeStackItem, { CardDefOrId } from './stack-item';

interface Signature {
  Element: HTMLElement;
  Args: {
    tag?: keyof HTMLElementTagNameMap;
    stackItems: StackItem[];
    stackIndex: number;
    publicAPI: Actions;
    close: (stackItem: StackItem) => void;
    onSelectedCards: (
      selectedCards: CardDefOrId[],
      stackItem: StackItem,
    ) => void;
    setupStackItem: (
      stackItem: StackItem,
      clearSelections: () => void,
      doWithStableScroll: (changeSizeCallback: () => Promise<void>) => void,
      doScrollIntoView: (selector: string) => void,
    ) => void;
  };
  Blocks: {};
}

export default class OperatorModeStack extends Component<Signature> {
  dismissStackedCardsAbove = task(async (itemIndex: number) => {
    let itemsToDismiss: StackItem[] = [];
    for (let i = this.args.stackItems.length - 1; i > itemIndex; i--) {
      itemsToDismiss.push(this.args.stackItems[i]);
    }
    await Promise.all(itemsToDismiss.map((i) => this.args.close(i)));
  });

  <template>
    <div ...attributes>
      <div class='inner'>
        {{#each @stackItems as |item i|}}
          <OperatorModeStackItem
            @item={{item}}
            @index={{i}}
            @stackItems={{@stackItems}}
            @publicAPI={{@publicAPI}}
            @dismissStackedCardsAbove={{perform this.dismissStackedCardsAbove}}
            @close={{@close}}
            @onSelectedCards={{@onSelectedCards}}
            @setupStackItem={{@setupStackItem}}
          />
        {{/each}}
      </div>
    </div>

    <style>
      :global(:root) {
        --stack-padding-top: calc(
          var(--submode-switcher-trigger-height) + (2 * (var(--boxel-sp)))
        );
        --stack-padding-bottom: calc(
          var(--search-sheet-closed-height) + (var(--boxel-sp))
        );
      }
      .operator-mode-stack {
        z-index: 0;
        height: 100%;
        width: 100%;
        background-position: center;
        background-size: cover;
        padding: var(--stack-padding-top) var(--boxel-sp)
          var(--stack-padding-bottom);
        position: relative;
      }
      .operator-mode-stack.with-bg-image:before {
        content: ' ';
        height: 100%;
        width: 2px;
        background-color: black;
        display: block;
        position: absolute;
        top: 0;
        left: -1px;
      }
      .operator-mode-stack.with-bg-image:first-child:before {
        display: none;
      }

      /* Add some padding to accomodate for overlaid header for embedded cards in operator mode */
      .operator-mode-stack :deep(.field-component-card.fitted-format) {
        padding-top: calc(
          var(--overlay-fitted-card-header-height) + var(--boxel-sp-lg)
        );
      }

      .operator-mode-stack
        :deep(.field-component-card.fitted-format .missing-embedded-template) {
        margin-top: calc(-1 * var(--boxel-sp-lg));
        border-radius: 0;
        border-bottom-left-radius: var(--boxel-form-control-border-radius);
        border-bottom-right-radius: var(--boxel-form-control-border-radius);
      }

      .inner {
        height: 100%;
        position: relative;
        display: flex;
        justify-content: center;
        margin: 0 auto;
        border-bottom-left-radius: var(--boxel-border-radius);
        border-bottom-right-radius: var(--boxel-border-radius);
      }
    </style>
  </template>
}
