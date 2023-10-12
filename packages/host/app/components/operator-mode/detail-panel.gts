import { hash, array } from '@ember/helper';
import { action } from '@ember/object';
import { service } from '@ember/service';

import Component from '@glimmer/component';

// @ts-expect-error cached doesn't have type yet
import { tracked, cached } from '@glimmer/tracking';

import { CardContainer, LoadingIndicator, Header } from '@cardstack/boxel-ui';

import { or, and } from '@cardstack/boxel-ui/helpers/truth-helpers';

import { type RealmInfo } from '@cardstack/runtime-common';

import {
  hasExecutableExtension,
  getPlural,
  isCardDocumentString,
} from '@cardstack/runtime-common';

import { type Ready } from '@cardstack/host/resources/file';
import IconInherit from '@cardstack/boxel-ui/icons/icon-inherit';
import IconTrash from '@cardstack/boxel-ui/icons/icon-trash';

import { type CardDef } from 'https://cardstack.com/base/card-api';

import { lastModifiedDate } from '../../resources/last-modified-date';

import {
  FileDefinitionContainer,
  InstanceDefinitionContainer,
  ModuleDefinitionContainer,
  ClickableModuleDefinitionContainer,
} from './definition-container';

import Selector from './detail-panel-selector';

import { SelectorItem, selectorItemFunc } from './detail-panel-selector';

import {
  type ModuleDeclaration,
  isCardOrFieldDeclaration,
} from '@cardstack/host/resources/module-contents';
import type OperatorModeStateService from '../../services/operator-mode-state-service';

import { isCardDef, isFieldDef } from '@cardstack/runtime-common/code-ref';

import { type CardType } from '@cardstack/host/resources/card-type';

interface Signature {
  Element: HTMLElement;
  Args: {
    realmInfo: RealmInfo | null;
    readyFile: Ready;
    cardInstance: CardDef | undefined;
    cardInstanceType: CardType | undefined;
    selectedDeclaration?: ModuleDeclaration;
    declarations: ModuleDeclaration[];
    selectDeclaration: (dec: ModuleDeclaration) => void;
    delete: () => void;
  };
}

export default class DetailPanel extends Component<Signature> {
  @service private declare operatorModeStateService: OperatorModeStateService;
  private lastModified = lastModifiedDate(this, () => this.args.readyFile);

  get cardType() {
    if (
      this.args.selectedDeclaration &&
      isCardOrFieldDeclaration(this.args.selectedDeclaration)
    ) {
      return this.args.selectedDeclaration.cardType;
    }
    return;
  }

  get isLoading() {
    return (
      this.args.declarations.some((dec) => {
        if (isCardOrFieldDeclaration(dec)) {
          return dec.cardType?.isLoading;
        } else {
          return false;
        }
      }) || this.cardType?.isLoading
    );
  }

  @action
  updateCodePath(url: URL | undefined) {
    if (url) {
      this.operatorModeStateService.updateCodePath(url);
    }
  }

  @action
  isSelected(dec: ModuleDeclaration) {
    return this.args.selectedDeclaration === dec;
  }

  get isCardInstance() {
    return (
      this.isJSON &&
      isCardDocumentString(this.args.readyFile.content) &&
      this.args.cardInstance !== undefined
    );
  }
  get isModule() {
    return hasExecutableExtension(this.args.readyFile.url);
  }

  get isBinary() {
    return this.args.readyFile.isBinary;
  }

  get isJSON() {
    return this.args.readyFile.url.endsWith('.json');
  }

  get isField() {
    if (
      this.args.selectedDeclaration &&
      isCardOrFieldDeclaration(this.args.selectedDeclaration)
    ) {
      return (
        this.isModule && isFieldDef(this.args.selectedDeclaration?.cardOrField)
      );
    }
    return false;
  }

  get isCard() {
    if (
      this.args.selectedDeclaration &&
      isCardOrFieldDeclaration(this.args.selectedDeclaration)
    ) {
      return (
        this.isModule && isCardDef(this.args.selectedDeclaration?.cardOrField)
      );
    }
    return false;
  }

  private get fileExtension() {
    if (!this.args.cardInstance) {
      return '.' + this.args.readyFile.url.split('.').pop() || '';
    } else {
      return '';
    }
  }

  get buildSelectorItems(): SelectorItem[] {
    if (!this.args.declarations) {
      return [];
    }
    return this.args.declarations.map((dec) => {
      const isSelected = this.args.selectedDeclaration === dec;
      return selectorItemFunc(
        [
          resolveElementName(dec),
          () => {
            this.args.selectDeclaration(dec);
          },
        ],
        { selected: isSelected },
      );
    });
  }

  get numberOfElementsGreaterThanZero() {
    return this.args.declarations.length > 0;
  }

  get numberOfElementsInFileString() {
    let numberOfElements = this.args.declarations.length || 0;
    return `${numberOfElements} ${getPlural('item', numberOfElements)}`;
  }

  <template>
    <div ...attributes>
      {{#if this.isLoading}}
        <div class='loading'>
          <LoadingIndicator />
        </div>
      {{else}}
        {{#if (and this.isModule this.numberOfElementsGreaterThanZero)}}
          <div class='in-this-file-panel'>
            <div class='in-this-file-panel-banner'>
              <header class='panel-header' aria-label='In This File Header'>
                In This File
              </header>
              <span class='number-items'>{{this.numberOfElementsInFileString}}
              </span>
            </div>
            <CardContainer class='in-this-file-card-container'>
              <Header
                @title={{@readyFile.name}}
                @hasBackground={{true}}
                class='header'
                data-test-current-module-name={{@readyFile.name}}
              />
              <Selector
                @class='in-this-file-menu'
                @items={{this.buildSelectorItems}}
                data-test-in-this-file-selector
              />
            </CardContainer>
          </div>
        {{/if}}

        {{#if (or this.isCardInstance this.isCard this.isField)}}
          <div class='inheritance-panel'>
            <header
              class='panel-header'
              aria-label='Inheritance Panel Header'
              data-test-inheritance-panel-header
            >
              Card Inheritance
            </header>
            {{#if this.isCardInstance}}
              {{! JSON case when visting, eg Author/1.json }}
              <InstanceDefinitionContainer
                @fileURL={{@readyFile.url}}
                @name={{@cardInstance.title}}
                @fileExtension='.JSON'
                @infoText={{this.lastModified.value}}
                @actions={{array
                  (hash label='Delete' handler=@delete icon=IconTrash)
                }}
              />
              <div class='chain'>
                <IconInherit
                  class='chain-icon'
                  width='24px'
                  height='24px'
                  role='presentation'
                />
                Adopts from
              </div>
              <ClickableModuleDefinitionContainer
                @title={{'Card Definition'}}
                @fileURL={{@cardInstanceType.type.module}}
                @name={{@cardInstanceType.type.displayName}}
                @fileExtension={{@cardInstanceType.type.moduleInfo.extension}}
                @onSelectDefinition={{this.updateCodePath}}
                @url={{@cardInstanceType.type.module}}
              />

            {{else if this.isField}}
              {{#let 'Field Definition' as |definitionTitle|}}
                <ModuleDefinitionContainer
                  @title={{definitionTitle}}
                  @fileURL={{this.cardType.type.module}}
                  @name={{this.cardType.type.displayName}}
                  @fileExtension={{this.cardType.type.moduleInfo.extension}}
                  @infoText={{this.lastModified.value}}
                  @isActive={{true}}
                  @actions={{array
                    (hash label='Delete' handler=@delete icon=IconTrash)
                  }}
                />
                {{#if this.cardType.type.super}}
                  <div class='chain'>
                    <IconInherit
                      class='chain-icon'
                      width='24px'
                      height='24px'
                      role='presentation'
                    />
                    Inherits from
                  </div>
                  <ClickableModuleDefinitionContainer
                    @title={{definitionTitle}}
                    @fileURL={{this.cardType.type.super.module}}
                    @name={{this.cardType.type.super.displayName}}
                    @fileExtension={{this.cardType.type.super.moduleInfo.extension}}
                    @onSelectDefinition={{this.updateCodePath}}
                    @url={{this.cardType.type.super.module}}
                  />
                {{/if}}
              {{/let}}
            {{else if this.isCard}}
              {{#let 'Card Definition' as |definitionTitle|}}
                <ModuleDefinitionContainer
                  @title={{definitionTitle}}
                  @fileURL={{this.cardType.type.module}}
                  @name={{this.cardType.type.displayName}}
                  @fileExtension={{this.cardType.type.moduleInfo.extension}}
                  @infoText={{this.lastModified.value}}
                  @isActive={{true}}
                  @actions={{array
                    (hash label='Delete' handler=@delete icon=IconTrash)
                  }}
                />
                {{#if this.cardType.type.super}}
                  <div class='chain'>
                    <IconInherit
                      class='chain-icon'
                      width='24px'
                      height='24px'
                      role='presentation'
                    />
                    Inherits from
                  </div>
                  <ClickableModuleDefinitionContainer
                    @title={{definitionTitle}}
                    @fileURL={{this.cardType.type.super.module}}
                    @name={{this.cardType.type.super.displayName}}
                    @fileExtension={{this.cardType.type.super.moduleInfo.extension}}
                    @onSelectDefinition={{this.updateCodePath}}
                    @url={{this.cardType.type.super.module}}
                  />
                {{/if}}
              {{/let}}
            {{/if}}
          </div>
        {{else}}
          {{#if (or this.isBinary this.isJSON)}}
            <div class='details-panel'>
              <header class='panel-header' aria-label='Details Panel Header'>
                Details
              </header>
              <FileDefinitionContainer
                @fileURL={{@readyFile.url}}
                @fileExtension={{this.fileExtension}}
                @infoText={{this.lastModified.value}}
                @actions={{array
                  (hash label='Delete' handler=@delete icon=IconTrash)
                }}
              />
            </div>
          {{/if}}
        {{/if}}
      {{/if}}
    </div>
    <style>
      .header {
        --boxel-header-padding: var(--boxel-sp-xs);
        --boxel-header-text-size: var(--boxel-font-size-xs);
        --boxel-header-text-transform: uppercase;
        --boxel-header-letter-spacing: var(--boxel-lsp-xxl);
        --boxel-header-background-color: var(--boxel-100);
        --boxel-header-text-color: var(--boxel-dark);
        --boxel-header-max-width: none;
      }
      .in-this-file-card-container {
        overflow: hidden;
        overflow-wrap: anywhere;
      }
      .in-this-file-panel-banner {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .panel-header {
        font: 700 var(--boxel-font);
        letter-spacing: var(--boxel-lsp-xs);
      }
      .number-items {
        color: #919191;
        font-size: var(--boxel-font-size-sm);
        font-weight: 200;
        letter-spacing: var(--boxel-lsp-xxl);
        text-transform: uppercase;
      }
      .selected {
        outline: 2px solid var(--boxel-highlight);
      }
      .in-this-file-panel,
      .details-panel,
      .inheritance-panel {
        padding-top: var(--boxel-sp-sm);
        gap: var(--boxel-sp-xs);
        display: flex;
        flex-direction: column;
      }
      .in-this-file-menu {
        padding: var(--boxel-sp-xs);
      }
      .loading {
        display: flex;
        justify-content: center;
      }
      .chain {
        display: flex;
        font: var(--boxel-font-size-sm);
        align-items: center;
        gap: var(--boxel-sp-xxxs);
        justify-content: center;
      }
      .chain-icon {
        --icon-color: var(--boxel-dark);
      }
    </style>
  </template>
}

const resolveElementName = (dec: ModuleDeclaration) => {
  let localName: string | undefined = dec.localName;
  if (isCardOrFieldDeclaration(dec)) {
    localName = dec.cardOrField.displayName;
  }
  return localName ?? '[No Name Found]';
};
