import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { action } from '@ember/object';
import { service } from '@ember/service';
import Component from '@glimmer/component';

import { tracked } from '@glimmer/tracking';

import ToElsewhere from 'ember-elsewhere/components/to-elsewhere';

import { Tooltip, Pill, RealmIcon } from '@cardstack/boxel-ui/components';
import { and, bool, gt } from '@cardstack/boxel-ui/helpers';

import { ArrowTopLeft, IconLink, IconPlus } from '@cardstack/boxel-ui/icons';

import { getPlural } from '@cardstack/runtime-common';

import { type ResolvedCodeRef } from '@cardstack/runtime-common/code-ref';
import type { ModuleSyntax } from '@cardstack/runtime-common/module-syntax';

import EditFieldModal from '@cardstack/host/components/operator-mode/edit-field-modal';
import RemoveFieldModal from '@cardstack/host/components/operator-mode/remove-field-modal';
import {
  type Type,
  type CodeRefType,
  type FieldOfType,
  getCodeRef,
} from '@cardstack/host/resources/card-type';

import type { Ready } from '@cardstack/host/resources/file';
import type CardService from '@cardstack/host/services/card-service';
import type LoaderService from '@cardstack/host/services/loader-service';

import OperatorModeStateService from '@cardstack/host/services/operator-mode-state-service';
import RealmService from '@cardstack/host/services/realm';
import {
  isOwnField,
  calculateTotalOwnFields,
} from '@cardstack/host/utils/schema-editor';

import type { BaseDef } from 'https://cardstack.com/base/card-api';

import ContextMenuButton from './context-menu-button';

interface Signature {
  Args: {
    card: typeof BaseDef;
    file: Ready;
    cardType: Type;
    moduleSyntax: ModuleSyntax;
    allowFieldManipulation: boolean;
    childFields: string[];
    parentFields: string[];
    goToDefinition: (
      codeRef: ResolvedCodeRef | undefined,
      localName: string | undefined,
    ) => void;
  };
}

export default class CardSchemaEditor extends Component<Signature> {
  <template>
    <style scoped>
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
        padding: var(--boxel-sp-xs);
        border-radius: var(--boxel-border-radius);
        background-color: var(--boxel-light);
      }

      .card-field--with-context-menu-button {
        padding-right: 0;
      }

      .card-fields {
        margin-top: var(--boxel-sp);
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
        font: 600 var(--boxel-font);
        line-height: 20px;
        padding: var(--boxel-sp-5xs) var(--boxel-sp-xxs);
        background-color: var(--boxel-200);
        border-top-left-radius: var(--boxel-border-radius-sm);
        border-bottom-left-radius: var(--boxel-border-radius-sm);
        margin-bottom: calc(var(--boxel-sp-5xs) * -2);
        transform: translate(
          calc(var(--boxel-sp-5xs) * -1),
          calc(var(--boxel-sp-5xs) * -1)
        );
        height: 100%;
      }

      .linked-icon {
        --icon-color: var(--boxel-highlight);
        display: flex;
        align-items: center;
        height: 20px;

        margin-right: var(--boxel-sp-5xs);
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
        --icon-color: var(--boxel-highlight);
        background-color: transparent;
        color: var(--boxel-highlight);
        font-size: var(--boxel-font-sm);
        font-weight: 600;
        width: 100%;
        height: 56px;
        padding: var(--boxel-sp-xs);
        border-radius: var(--boxel-border-radius);
        border: 1px solid var(--boxel-500);
        margin: auto;
        align-items: center;
        justify-content: center;
        display: flex;
      }

      .add-field-button > span {
        margin-top: 1px;
      }

      .add-field-button > svg {
        margin-right: var(--boxel-sp-xxxs);
      }

      .add-field-button:hover {
        border: 1px solid var(--boxel-highlight);
        background-color: var(--boxel-100);
      }

      .card-field--overriding {
        transition: border 1s;
      }

      .show-overriding-field-border {
        border: 2px solid var(--boxel-highlight);
      }

      .icon {
        min-width: var(--boxel-icon-sm);
        min-height: var(--boxel-icon-sm);
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
      {{#let (getCodeRef @cardType) as |codeRef|}}
        <div class='header'>
          <Tooltip @placement='bottom'>
            <:trigger>
              <Pill
                @kind='button'
                {{on 'click' (fn @goToDefinition codeRef @cardType.localName)}}
                data-test-card-schema-navigational-button
              >
                <:iconLeft>
                  <RealmIcon
                    @realmInfo={{this.realm.info @cardType.module}}
                    class='icon'
                  />
                </:iconLeft>
                <:default>
                  {{@cardType.displayName}}
                </:default>
              </Pill>
            </:trigger>
            <:content>
              {{@cardType.module}}
              {{#if codeRef.name}}
                ({{codeRef.name}})
              {{else}}
                ({{@cardType.localName}})
              {{/if}}
            </:content>
          </Tooltip>
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
      {{/let}}

      <div class='card-fields'>
        {{#each @cardType.fields as |field|}}
          {{#if (this.isOwnField field.name)}}
            <div
              class='card-field
                {{if (this.isOverriding field) "card-field--overriding"}}
                {{if
                  @allowFieldManipulation
                  "card-field--with-context-menu-button"
                }}'
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
                  {{#let (getCodeRef field) as |codeRef|}}
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
                      <Tooltip @placement='bottom'>
                        <:trigger>
                          <Pill
                            @kind='button'
                            {{on
                              'click'
                              (fn @goToDefinition codeRef field.card.localName)
                            }}
                            data-test-card-schema-field-navigational-button
                          >
                            <:iconLeft>
                              {{#if field.isComputed}}
                                <span
                                  class='computed-icon'
                                  data-test-computed-icon
                                >
                                  =
                                </span>
                              {{/if}}
                              {{#if (this.isLinkedField field)}}
                                <span class='linked-icon' data-test-linked-icon>
                                  <IconLink width='16px' height='16px' />
                                </span>
                              {{/if}}
                              <RealmIcon
                                @realmInfo={{this.realm.info moduleUrl}}
                                class='icon'
                              />
                            </:iconLeft>
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
                        </:trigger>
                        <:content>
                          {{moduleUrl}}
                          {{#if codeRef.name}}
                            ({{codeRef.name}})
                          {{/if}}
                        </:content>
                      </Tooltip>

                      {{#if @allowFieldManipulation}}
                        <ContextMenuButton
                          @toggleSettings={{fn this.toggleEditFieldModal field}}
                          @toggleRemoveModal={{fn
                            this.toggleRemoveFieldModalShown
                            field
                          }}
                          data-test-schema-editor-field-contextual-button
                        />
                      {{/if}}
                    {{/if}}
                  {{/let}}
                {{/let}}
              </div>
            </div>
          {{/if}}
        {{/each}}
      </div>

      {{#if @allowFieldManipulation}}
        <button
          class='add-field-button'
          data-test-add-field-button
          {{on 'click' (fn this.toggleEditFieldModal undefined)}}
        >
          <IconPlus width='20px' height='20px' role='presentation' />
          <span>
            Add a field
          </span>
        </button>

        {{#if this.editFieldModalShown}}
          <ToElsewhere
            @named='schema-editor-modal'
            @send={{component
              EditFieldModal
              file=@file
              card=@card
              moduleSyntax=@moduleSyntax
              onClose=(fn this.toggleEditFieldModal undefined)
              field=this.fieldBeingEdited
            }}
          />
        {{/if}}

        {{#if (and this.removeFieldModalShown (bool this.fieldForRemoval))}}
          <ToElsewhere
            @named='schema-editor-modal'
            @send={{component
              RemoveFieldModal
              file=@file
              card=@card
              moduleSyntax=@moduleSyntax
              onClose=(fn this.toggleRemoveFieldModalShown undefined)
              field=this.fieldForRemoval
            }}
          />
        {{/if}}
      {{/if}}
    </div>
  </template>

  @service declare loaderService: LoaderService;
  @service declare cardService: CardService;
  @service declare operatorModeStateService: OperatorModeStateService;
  @service private declare realm: RealmService;

  @tracked editFieldModalShown = false;
  @tracked removeFieldModalShown = false;
  @tracked private fieldForRemoval?: FieldOfType = undefined;
  @tracked private fieldBeingEdited?: FieldOfType = undefined;

  @action toggleEditFieldModal(field?: FieldOfType) {
    this.fieldBeingEdited = field;
    this.editFieldModalShown = !this.editFieldModalShown;
  }

  @action toggleRemoveFieldModalShown(field?: FieldOfType) {
    this.fieldForRemoval = field;
    this.removeFieldModalShown = !this.removeFieldModalShown;
  }

  @action openCardDefinition(moduleURL: string) {
    this.operatorModeStateService.updateCodePath(new URL(moduleURL));
  }

  @action
  isOwnField(fieldName: string): boolean {
    return isOwnField(this.args.card, fieldName);
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
}
