import { type EmptyObject } from '@ember/component/helper';

import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { action } from '@ember/object';
import Component from '@glimmer/component';

import compact from 'ember-composable-helpers/helpers/compact';

import { cn, eq } from '@cardstack/boxel-ui/helpers';

import { DiagonalArrowLeftUp } from '@cardstack/boxel-ui/icons';

import {
  isCardDef,
  isBaseDef,
  isFieldDef,
} from '@cardstack/runtime-common/code-ref';

import scrollIntoViewModifier from '@cardstack/host/modifiers/scroll-into-view';
import {
  type ModuleDeclaration,
  isCardOrFieldDeclaration,
} from '@cardstack/host/resources/module-contents';

interface SelectorItemOptions {
  action: Function;
  url: string;
  selected: boolean;
  disabled: boolean;
}
export class SelectorItem {
  declaration: ModuleDeclaration;
  selected: boolean;
  disabled: boolean;
  action: Function | undefined;

  constructor(
    declaration: ModuleDeclaration,
    options: Partial<SelectorItemOptions>,
  ) {
    this.declaration = declaration;
    this.action = options.action;
    this.selected = options.selected || false;
    this.disabled = options.disabled || false;
  }
}

export function selectorItemFunc(
  params: [ModuleDeclaration, Function],
  named: Partial<SelectorItemOptions>,
): SelectorItem {
  let opts = Object.assign({}, named);
  opts.action = params[1];
  return new SelectorItem(params[0], opts);
}

class SelectorItemRenderer extends Component<{
  Args: { selectorItem: SelectorItem };
  Blocks: {
    item: [SelectorItem];
  };
}> {
  get asSelectorItem(): SelectorItem {
    return this.args.selectorItem as SelectorItem;
  }
  <template>
    {{yield this.asSelectorItem to='item'}}
  </template>
}

interface Signature {
  Element: HTMLUListElement;
  Args: {
    class?: string;
    items: Array<SelectorItem>;
  };
  Blocks: EmptyObject;
}

export default class Selector extends Component<Signature> {
  @action invokeSelectorItemAction(
    action: unknown,
    e: Event | KeyboardEvent,
  ): void {
    e.preventDefault();

    if (e.type === 'keypress' && (e as KeyboardEvent).key !== 'Enter') {
      return;
    }

    (action as () => never)();
  }

  getType(declaration: ModuleDeclaration) {
    let type = declaration.type as string;
    debugger;
    if (isCardDef(declaration.cardOrField)) {
      type = 'card';
      if (declaration.type === 'specifier') {
        type = 'card-specifier';
      }
    } else if (isFieldDef(declaration.cardOrField)) {
      type = 'field';
      if (declaration.type === 'specifier') {
        type = 'card-specifier';
      }
    } else if (isBaseDef(declaration.cardOrField)) {
      type = 'base';
    } else if (declaration.type === 'specifier') {
      type = 'specifier';
    } else {
      throw new Error(
        'card or field declaration does not have an appropriate type',
      );
    }
    return type;
  }

  <template>
    <ul role='menu' class={{cn 'boxel-selector' @class}} ...attributes>
      {{#if @items}}
        {{#each (compact @items) as |selectorItem|}}
          <SelectorItemRenderer @selectorItem={{selectorItem}}>
            <:item as |selectorItem|>
              <li
                role='none'
                class={{cn
                  'boxel-selector__item'
                  boxel-selector__item--selected=selectorItem.selected
                  boxel-selector__item--disabled=selectorItem.disabled
                }}
                data-test-boxel-selector-item
                data-test-boxel-selector-item-selected={{selectorItem.selected}}
                {{scrollIntoViewModifier selectorItem.selected}}
              >
                {{! template-lint-disable require-context-role }}
                <div
                  class='boxel-selector__item__content'
                  role='menuitem'
                  href='#'
                  data-boxel-selector-item-text={{selectorItem.declaration.localName}}
                  data-test-boxel-selector-item-text={{selectorItem.declaration.localName}}
                  {{on
                    'click'
                    (fn this.invokeSelectorItemAction selectorItem.action)
                  }}
                  {{on
                    'keypress'
                    (fn this.invokeSelectorItemAction selectorItem.action)
                  }}
                  disabled={{selectorItem.disabled}}
                >
                  <div class='selector-item'>
                    {{#if selectorItem.declaration.exportedAs}}
                      <span class='exported-arrow'>
                        <DiagonalArrowLeftUp width='20' height='20' />
                      </span>
                      <span
                        class='exported'
                      >{{selectorItem.declaration.exportedAs}}</span>
                      {{#unless
                        (eq
                          selectorItem.declaration.exportedAs
                          selectorItem.declaration.localName
                        )
                      }}<span
                        >({{selectorItem.declaration.localName}})</span>{{/unless}}
                    {{else}}
                      <span class='non-exported'>{{if
                          selectorItem.declaration.localName
                          selectorItem.declaration.localName
                          '[No Name Found]'
                        }}</span>
                    {{/if}}
                    <span class='type'>{{this.getType
                        selectorItem.declaration
                      }}</span>
                  </div>
                </div>
              </li>
            </:item>
          </SelectorItemRenderer>
        {{/each}}
      {{/if}}
    </ul>
    <style>
      @layer {
        .boxel-selector {
          --boxel-selector-border-radius: var(--boxel-border-radius);
          --boxel-selector-color: var(--boxel-light);
          --boxel-selector-current-color: var(--boxel-light-100);
          --boxel-selector-selected-color: var(--boxel-highlight);
          --boxel-selector-disabled-color: var(--boxel-highlight);
          --boxel-selector-font: 500 var(--boxel-font-sm);
          --boxel-selector-item-gap: var(--boxel-sp-xxs);
          --boxel-selector-item-content-padding: var(--boxel-sp-xs);
          --boxel-selector-selected-background-color: var(--boxel-highlight);
          --boxel-selector-selected-font-color: var(--boxel-light-100);
          --boxel-selector-selected-hover-font-color: var(--boxel-light);
          --boxel-selector-selected-hover-background-color: var(
            --boxel-highlight-hover
          );
          list-style-type: none;
          margin: 0;
          padding: 0;
          background-color: var(--boxel-selector-color);
          border-radius: var(--boxel-selector-border-radius);
        }

        .boxel-selector__item {
          font: var(--boxel-selector-font);
          letter-spacing: var(--boxel-lsp-sm);
          border-radius: inherit;
        }

        .boxel-selector__item:hover {
          background-color: var(--boxel-selector-current-color);
          cursor: pointer;
        }

        .boxel-selector__item > .boxel-selector__item__content {
          width: 100%;
          padding: var(--boxel-selector-item-content-padding);
        }

        .boxel-selector__item--disabled .boxel-selector__item__content {
          pointer-events: none;
        }

        .boxel-selector__item > .boxel-selector__item__content:hover {
          color: inherit;
        }

        .boxel-selector__item__content:focus-visible {
          outline: var(--boxel-outline);
        }

        .boxel-selector__item--selected {
          background-color: var(--boxel-selector-selected-background-color);
          color: var(--boxel-selector-selected-font-color);
        }

        .boxel-selector__item--selected:hover {
          background-color: var(
            --boxel-selector-selected-hover-background-color
          );
        }

        .boxel-selector__item--dangerous {
          color: var(--boxel-danger);
          fill: var(--boxel-danger);
        }

        .boxel-selector__item--disabled,
        .boxel-selector__item--disabled.boxel-selector__item:hover {
          background-color: initial;
          opacity: 0.4;
        }

        .selector-item {
          --icon-color: var(--boxel-highlight);

          display: flex;
          align-items: center;
          overflow-wrap: anywhere;
          overflow: hidden;
          gap: var(--boxel-selector-item-gap);
        }

        .boxel-selector__item--selected .selector-item {
          color: var(--boxel-light);
          --icon-color: var(--boxel-light);
        }

        .exported {
          font-weight: 700;
        }

        .non-exported {
          padding-left: calc(var(--boxel-selector-item-gap) + 20px);
        }

        .type {
          margin-left: auto;
          text-transform: uppercase;
          color: var(--boxel-450);
          white-space: nowrap;
        }

        .boxel-selector__item--selected .selector-item .type {
          color: var(--boxel-light);
        }
      }
    </style>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    Selector: typeof Selector;
  }
}
