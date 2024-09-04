import {
  contains,
  field,
  Component,
  CardDef,
  FieldDef,
  relativeTo,
  realmInfo,
} from './card-api';
import StringField from './string';
import BooleanField from './boolean';
import CodeRef from './code-ref';

import { FieldContainer } from '@cardstack/boxel-ui/components';
import GlimmerComponent from '@glimmer/component';

export class CatalogEntry extends CardDef {
  static displayName = 'Catalog Entry';
  @field title = contains(StringField);
  @field description = contains(StringField);
  @field ref = contains(CodeRef);

  // If it's not a field, then it's a card
  @field isField = contains(BooleanField);

  @field moduleHref = contains(StringField, {
    computeVia: function (this: CatalogEntry) {
      return new URL(this.ref.module, this[relativeTo]).href;
    },
  });
  @field demo = contains(FieldDef);
  @field realmName = contains(StringField, {
    computeVia: function (this: CatalogEntry) {
      return this[realmInfo]?.name;
    },
  });
  @field thumbnailURL = contains(StringField, { computeVia: () => null }); // remove this if we want card type entries to have images

  get showDemo() {
    return !this.isField;
  }

  // An explicit edit template is provided since computed isPrimitive bool
  // field (which renders in the embedded format) looks a little wonky
  // right now in the edit view.
  static edit = class Edit extends Component<typeof this> {
    <template>
      <CatalogEntryContainer>
        <FieldContainer @tag='label' @label='Title' data-test-field='title'>
          <@fields.title />
        </FieldContainer>
        <FieldContainer
          @tag='label'
          @label='Description'
          data-test-field='description'
        >
          <@fields.description />
        </FieldContainer>
        <FieldContainer @label='Ref' data-test-field='ref'>
          <@fields.ref />
        </FieldContainer>
        <FieldContainer @label='Workspace Name' data-test-field='realmName'>
          <@fields.realmName />
        </FieldContainer>
        <FieldContainer @vertical={{true}} @label='Demo' data-test-field='demo'>
          <@fields.demo />
        </FieldContainer>
      </CatalogEntryContainer>
    </template>
  };

  static embedded = class Embedded extends Component<typeof this> {
    <template>
      <CatalogEntryContainer class='embedded'>
        <header class='title'>
          <@fields.title />
        </header>
        <p class='description' data-test-description>
          <@fields.description />
        </p>
      </CatalogEntryContainer>
      <style>
        .embedded > * {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .title {
          font: 700 var(--boxel-font-sm);
        }

        .description {
          margin: 0;
          color: var(--boxel-500);
          font-size: var(--boxel-font-size-xs);
        }
      </style>
    </template>
  };

  static isolated = class Isolated extends Component<typeof this> {
    <template>
      <CatalogEntryContainer class='container'>
        <h1 data-test-title><@fields.title /></h1>
        <em data-test-description><@fields.description /></em>
        <div data-test-ref>
          Module:
          <@fields.moduleHref />
          Name:
          {{@model.ref.name}}
        </div>
        <div class='realm-name' data-test-realm-name>
          in
          <@fields.realmName />
        </div>
        {{#if @model.showDemo}}
          <div data-test-demo><@fields.demo /></div>
        {{/if}}
      </CatalogEntryContainer>
      <style>
        .container {
          padding: var(--boxel-sp);
        }
        .realm-name {
          color: var(--boxel-teal);
          font-size: var(--boxel-font-size-xs);
        }
      </style>
    </template>
  };
}

interface Signature {
  Element: HTMLElement;
  Blocks: {
    default: [];
  };
}

class CatalogEntryContainer extends GlimmerComponent<Signature> {
  <template>
    <div class='entry' ...attributes>
      {{yield}}
    </div>
    <style>
      .entry {
        display: grid;
        gap: 3px;
        font: var(--boxel-font-sm);
      }
    </style>
  </template>
}
