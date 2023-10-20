import { fn, array } from '@ember/helper';
import { on } from '@ember/modifier';
import { action } from '@ember/object';
import { service } from '@ember/service';
import Component from '@glimmer/component';

import { tracked } from '@glimmer/tracking';
import { DropdownButton } from '@cardstack/boxel-ui/components';
import { gt, menuDivider, menuItem } from '@cardstack/boxel-ui/helpers';

import { getPlural } from '@cardstack/runtime-common';

import type { ModuleSyntax } from '@cardstack/runtime-common/module-syntax';

import Pill from '@cardstack/host/components/pill';
import AddFieldModal from '@cardstack/host/components/operator-mode/add-field-modal';
import RealmIcon from '@cardstack/host/components/operator-mode/realm-icon';
import RealmInfoProvider from '@cardstack/host/components/operator-mode/realm-info-provider';
import RemoveFieldModal from '@cardstack/host/components/operator-mode/remove-field-modal';
import {
  type Type,
  type CodeRefType,
  type FieldOfType,
} from '@cardstack/host/resources/card-type';
import {
  ArrowTopLeft,
  IconLink,
  ThreeDotsHorizontal,
  Warning as WarningIcon,
} from '@cardstack/boxel-ui/icons';

import type { Ready } from '@cardstack/host/resources/file';
import type CardService from '@cardstack/host/services/card-service';
import type LoaderService from '@cardstack/host/services/loader-service';

import OperatorModeStateService from '@cardstack/host/services/operator-mode-state-service';
import {
  isOwnField,
  calculateTotalOwnFields,
} from '@cardstack/host/utils/schema-editor';

import type { BaseDef } from 'https://cardstack.com/base/card-api';

interface Signature {
  Args: {
    card: typeof BaseDef;
    file: Ready;
    cardType: Type;
    moduleSyntax: ModuleSyntax;
    allowAddingFields: boolean;
    childFields: string[];
    parentFields: string[];
  };
}

export default class CardSchemaEditor extends Component<Signature> {
  <template>
    <style>
      .schema-editor-container {
        margin-top: var(--boxel-sp);
      }

      .schema-editor-container:first-child {
        margin-top: 0;
      }

      .schema {
        display: grid;
        gap: var(--boxel-sp);
        padding: var(--boxel-sp);
      }

      .card-field {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--boxel-sp-xxs);
        margin-bottom: var(--boxel-sp-xs);
        padding: var(--boxel-sp-xs) 0 var(--boxel-sp-xs) var(--boxel-sp-xs);
        border-radius: var(--boxel-border-radius);
        background-color: var(--boxel-light);
      }

      .card-fields {
        margin-top: var(--boxel-sp);
      }

      :global(.context-menu) {
        width: 13.5rem;
      }

      .context-menu-trigger {
        rotate: 90deg;
        --dropdown-button-size: 20px;
      }

      .context-menu-list {
        --boxel-menu-item-content-padding: var(--boxel-sp-xs) var(--boxel-sp-sm);
        border-top-right-radius: 0;
        border-top-left-radius: 0;
      }

      .warning-box {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--boxel-sp-xxxs);
        padding: var(--boxel-sp-sm);
        background-color: var(--boxel-warning-100);
        border-top-right-radius: inherit;
        border-top-left-radius: inherit;
      }

      .warning {
        margin: 0;
      }

      .left {
        display: flex;
        flex-direction: column;
      }

      .right {
        display: flex;
        align-items: center;
      }

      .computed-icon {
        display: inline-flex;
        font: 700 var(--boxel-font);
        letter-spacing: var(--boxel-lsp-xs);
        padding: var(--boxel-sp-xxxs) var(--boxel-sp-xs);
        background-color: var(--boxel-200);
        border-radius: var(--boxel-border-radius-sm);
        margin-right: var(--boxel-sp-xxs);
      }

      .linked-icon {
        --icon-color: var(--boxel-highlight);
        display: flex;
        align-items: center;
        height: 20px;

        margin-right: var(--boxel-sp-xxxs);
      }

      .field-name {
        font: 500 var(--boxel-font-sm);
        letter-spacing: var(--boxel-lsp-xs);
      }

      .overridden-field {
        text-decoration: line-through;
      }

      .overridden-field-link {
        --icon-color: var(--boxel-highlight);
        display: inline-flex;
        align-items: center;
        font: 500 var(--boxel-font-sm);
        letter-spacing: var(--boxel-lsp-xs);
        color: var(--boxel-highlight);
        cursor: pointer;
        border: none;
        background: none;
        padding: 0;
      }

      .field-types {
        color: var(--boxel-450);
        font: 500 var(--boxel-font-xs);
        letter-spacing: var(--boxel-lsp-xs);
      }

      .realm-icon > img {
        height: 20px;
        width: 20px;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .total-fields {
        display: flex;
        align-items: baseline;
        gap: var(--boxel-sp-xxxs);
        margin-left: auto;
      }

      .total-fields > * {
        margin: 0;
      }

      .total-fields-value {
        font: 600 var(--boxel-font);
      }

      .total-fields-label {
        font: var(--boxel-font-sm);
      }

      .add-field-button {
        background-color: transparent;
        border: none;
        color: var(--boxel-highlight);
        font-size: var(--boxel-font-sm);
        font-weight: 600;
      }

      .overriding-field {
        transition: border 1s;
      }

      .show-overriding-field-border {
        border: 2px solid var(--boxel-highlight);
      }

      @keyframes pulse {
        0% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.2);
        }
        100% {
          transform: scale(1);
        }
      }

      .overriding-field .show-overriding-field-border {
        animation: pulse 1s;
      }
    </style>

    <div
      class='schema-editor-container'
      data-test-card-schema={{@cardType.displayName}}
    >
      <div class='header'>
        <Pill
          @onClick={{(fn this.openCardDefinition @cardType.module)}}
          data-test-card-schema-navigational-button
        >
          <:icon>
            <RealmInfoProvider @fileURL={{@cardType.module}}>
              <:ready as |realmInfo|>
                <RealmIcon
                  @realmIconURL={{realmInfo.iconURL}}
                  @realmName={{realmInfo.name}}
                />
              </:ready>
            </RealmInfoProvider>
          </:icon>
          <:default>
            {{@cardType.displayName}}
          </:default>
        </Pill>
        <div class='total-fields' data-test-total-fields>
          {{#if (gt this.totalOwnFields 0)}}
            <span class='total-fields-value'>+ {{this.totalOwnFields}}</span>
            <span class='total-fields-label'>{{getPlural
                'Field'
                this.totalOwnFields
              }}</span>
          {{else}}
            <span class='total-fields-label'>No Fields</span>
          {{/if}}
        </div>
      </div>

      <div class='card-fields'>
        {{#each @cardType.fields as |field|}}
          {{#if (this.isOwnField field.name)}}
            <div
              class={{if
                (this.isOverriding field)
                'card-field overidding-field'
                'card-field'
              }}
              data-field-name={{field.name}}
              data-test-field-name={{field.name}}
            >
              <div class='left'>
                <div
                  class={{if
                    (this.isOverridden field)
                    'field-name overridden-field'
                    'field-name'
                  }}
                >
                  {{field.name}}
                </div>
                <div class='field-types' data-test-field-types>
                  {{this.fieldTypes field}}
                </div>
              </div>
              <div class='right'>
                {{#let (this.fieldModuleURL field) as |moduleUrl|}}
                  {{#if field.isComputed}}
                    <span class='computed-icon' data-test-computed-icon>
                      =
                    </span>
                  {{/if}}
                  {{#if (this.isOverridden field)}}
                    <button
                      class='overridden-field-link'
                      data-test-overridden-field-link
                      {{on 'click' (fn this.scrollIntoOveridingField field)}}
                    >Jump to active field definition
                      <span><ArrowTopLeft
                          width='20px'
                          height='20px'
                          role='presentation'
                        /></span></button>

                  {{else}}
                    <Pill
                      @onClick={{fn this.openCardDefinition moduleUrl}}
                      data-test-card-schema-field-navigational-button
                    >
                              <:icon>
                      {{#if (this.isLinkedField field)}}
                        <span class='linked-icon' data-test-linked-icon>
                          <IconLink width='16px' height='16px' />
                        </span>
                      {{/if}}
            <RealmInfoProvider @fileURL={{@cardType.module}}>
              <:ready as |realmInfo|>
                <RealmIcon
                  @realmIconURL={{realmInfo.iconURL}}
                  @realmName={{realmInfo.name}}
                />
              </:ready>
            </RealmInfoProvider>
          </:icon>
          <:default>
                          {{#let
                            (this.fieldCardDisplayName field.card)
                            as |cardDisplayName|
                          }}
                            <span
                              data-test-card-display-name={{cardDisplayName}}
                            >{{cardDisplayName}}</span>
                          {{/let}}
          </:default>
        </Pill>

                    {{!-- <button
                      class='pill'
                      data-test-card-schema-field-navigational-button
                      {{on 'click' (fn this.openCardDefinition moduleUrl)}}
                    >
                      {{#if (this.isLinkedField field)}}
                        <span class='linked-icon' data-test-linked-icon>
                          <IconLink width='16px' height='16px' />
                        </span>
                      {{/if}}
                      <div class='realm-icon'>
                        <RealmInfoProvider @fileURL={{moduleUrl}}>
                          <:ready as |realmInfo|>
                            <RealmIcon
                              @realmIconURL={{realmInfo.iconURL}}
                              @realmName={{realmInfo.name}}
                            />
                          </:ready>
                        </RealmInfoProvider>
                      </div>
                      <div>
                        <span>
                          {{#let
                            (this.fieldCardDisplayName field.card)
                            as |cardDisplayName|
                          }}
                            <span
                              data-test-card-display-name={{cardDisplayName}}
                            >{{cardDisplayName}}</span>
                          {{/let}}
                        </span>
                      </div>
                    </button> --}}
                    <DropdownButton
                      @icon={{ThreeDotsHorizontal}}
                      @label='field options'
                      @contentClass='context-menu'
                      class='context-menu-trigger'
                      data-test-schema-editor-field-contextual-button
                      as |dd|
                    >
                      <div class='warning-box'>
                        <p class='warning'>
                          These actions will break compatibility with existing
                          card instances.
                        </p>
                        <span class='warning-icon'>
                          <WarningIcon
                            width='20px'
                            height='20px'
                            role='presentation'
                          />
                        </span>
                      </div>
                      <dd.Menu
                        class='context-menu-list'
                        @items={{array
                          (menuItem
                            'Edit Field Name' this.editFieldName disabled=true
                          )
                          (menuDivider)
                          (menuItem
                            'Remove Field'
                            (fn this.toggleRemoveFieldModalShown field)
                            dangerous=true
                          )
                        }}
                      />
                    </DropdownButton>
                  {{/if}}
                {{/let}}
              </div>
            </div>
          {{/if}}
        {{/each}}
      </div>

      {{#if @allowAddingFields}}
        <button
          class='add-field-button'
          data-test-add-field-button
          {{on 'click' this.toggleAddFieldModal}}
        >
          + Add a field
        </button>

        {{#if this.addFieldModalShown}}
          <AddFieldModal
            @file={{@file}}
            @card={{@card}}
            @moduleSyntax={{@moduleSyntax}}
            @onClose={{this.toggleAddFieldModal}}
          />
        {{/if}}
      {{/if}}

      {{#if this.removeFieldModalShown}}
        <RemoveFieldModal
          @file={{@file}}
          @card={{@card}}
          @field={{this.fieldForRemoval}}
          @moduleSyntax={{@moduleSyntax}}
          @onClose={{this.toggleRemoveFieldModalShown}}
          data-test-remove-field-modal
        />
      {{/if}}
    </div>
  </template>

  @service declare loaderService: LoaderService;
  @service declare cardService: CardService;
  @service declare operatorModeStateService: OperatorModeStateService;

  @tracked addFieldModalShown = false;
  @tracked removeFieldModalShown = false;
  @tracked private _fieldForRemoval?: FieldOfType = undefined;

  @action toggleAddFieldModal() {
    this.addFieldModalShown = !this.addFieldModalShown;
  }

  @action toggleRemoveFieldModalShown(field?: FieldOfType) {
    this._fieldForRemoval = field;
    this.removeFieldModalShown = !this.removeFieldModalShown;
  }

  @action openCardDefinition(moduleURL: string) {
    this.operatorModeStateService.updateCodePath(new URL(moduleURL));
  }

  @action
  isOwnField(fieldName: string): boolean {
    return isOwnField(this.args.card, fieldName);
  }

  @action
  editFieldName() {
    // TODO: implement
    return;
  }

  get totalOwnFields() {
    return calculateTotalOwnFields(this.args.card, this.args.cardType);
  }

  fieldCardDisplayName(fieldCard: Type | CodeRefType): string {
    return fieldCard.displayName;
  }

  fieldModuleURL(field: FieldOfType) {
    return (field.card as Type).module;
  }

  @action
  fieldTypes(field: FieldOfType) {
    let types = [];

    if (this.isOverridden(field)) {
      types.push('Overridden');
    }

    if (this.isOverriding(field)) {
      types.push('Override');
    }

    if (this.isLinkedField(field)) {
      types.push('Link');
    }

    if (field.type === 'containsMany' || field.type === 'linksToMany') {
      types.push('Collection');
    }

    if (field.isComputed) {
      types.push('Computed');
    }

    return types.join(', ');
  }

  @action
  isOverriding(field: FieldOfType) {
    return this.args.parentFields.includes(field.name);
  }

  @action
  isOverridden(field: FieldOfType) {
    return this.args.childFields.includes(field.name);
  }

  isLinkedField(field: FieldOfType) {
    return field.type === 'linksTo' || field.type === 'linksToMany';
  }

  @action
  scrollIntoOveridingField(field: FieldOfType) {
    if (!this.isOverridden(field)) {
      return;
    }

    // This code assumes that the overriding field
    // is always located in the top result returned by the query selector.
    let element = document.querySelector(`[data-field-name='${field.name}']`);
    element?.classList.add('show-overriding-field-border');
    setTimeout(() => {
      element?.classList.remove('show-overriding-field-border');
    }, 1000);
    element?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
      inline: 'nearest',
    });
  }

  get fieldForRemoval(): FieldOfType {
    if (!this._fieldForRemoval) {
      throw new Error('fieldForRemoval should be set');
    }

    return this._fieldForRemoval;
  }
}
