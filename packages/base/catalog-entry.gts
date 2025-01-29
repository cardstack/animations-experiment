import {
  contains,
  field,
  Component,
  CardDef,
  relativeTo,
  linksToMany,
  FieldDef,
  containsMany,
  getCardMeta,
  type CardorFieldTypeIcon,
} from './card-api';
import StringField from './string';
import BooleanField from './boolean';
import CodeRef from './code-ref';
import MarkdownField from './markdown';
import { restartableTask } from 'ember-concurrency';
import {
  FieldContainer,
  LoadingIndicator,
  Pill,
  RealmIcon,
} from '@cardstack/boxel-ui/components';
import { loadCard, Loader } from '@cardstack/runtime-common';
import { eq } from '@cardstack/boxel-ui/helpers';

import GlimmerComponent from '@glimmer/component';
import BoxModel from '@cardstack/boxel-icons/box-model';
import BookOpenText from '@cardstack/boxel-icons/book-open-text';
import LayersSubtract from '@cardstack/boxel-icons/layers-subtract';
import GitBranch from '@cardstack/boxel-icons/git-branch';
import { DiagonalArrowLeftUp as ExportArrow } from '@cardstack/boxel-ui/icons';
import StackIcon from '@cardstack/boxel-icons/stack';
import AppsIcon from '@cardstack/boxel-icons/apps';
import LayoutList from '@cardstack/boxel-icons/layout-list';
import Brain from '@cardstack/boxel-icons/brain';

export type BoxelSpecType = 'card' | 'field' | 'app' | 'skill';

export class SpecType extends StringField {
  static displayName = 'Spec Type';
}

export class CatalogEntry extends CardDef {
  static displayName = 'Catalog Entry';
  static icon = BoxModel;
  @field name = contains(StringField);
  @field readMe = contains(MarkdownField);

  @field ref = contains(CodeRef);
  @field specType = contains(SpecType);

  @field isField = contains(BooleanField, {
    computeVia: function (this: CatalogEntry) {
      return this.specType === 'field';
    },
  });

  @field isCard = contains(BooleanField, {
    computeVia: function (this: CatalogEntry) {
      return (
        this.specType === 'card' ||
        this.specType === 'app' ||
        this.specType === 'skill'
      );
    },
  });
  @field moduleHref = contains(StringField, {
    computeVia: function (this: CatalogEntry) {
      return new URL(this.ref.module, this[relativeTo]).href;
    },
  });
  @field linkedExamples = linksToMany(CardDef);
  @field containedExamples = containsMany(FieldDef, { isUsed: true });
  @field title = contains(StringField, {
    computeVia: function (this: CatalogEntry) {
      if (this.name) {
        return this.name;
      }
      return this.ref.name === 'default' ? undefined : this.ref.name;
    },
  });

  static fitted = class Fitted extends Component<typeof this> {
    <template>
      <CatalogEntryContainer class='fitted'>
        <header class='title' data-test-title>
          <@fields.title />
        </header>
        <p class='description' data-test-description>
          <@fields.description />
        </p>
      </CatalogEntryContainer>
      <style scoped>
        .fitted > * {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .title {
          font: 600 var(--boxel-font-sm);
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
    icon: CardorFieldTypeIcon | undefined;

    get defaultIcon() {
      return this.args.model.constructor?.icon;
    }
    constructor(owner: any, args: any) {
      super(owner, args);
      this.loadCardIcon.perform();
    }

    private loadCardIcon = restartableTask(async () => {
      if (this.args.model.ref && this.args.model.id) {
        let card = await loadCard(this.args.model.ref, {
          loader: myLoader(),
          relativeTo: new URL(this.args.model.id),
        });
        this.icon = card.icon;
      }
    });

    private get realmInfo() {
      return getCardMeta(this.args.model as CardDef, 'realmInfo');
    }

    <template>
      <article class='container'>
        <header class='header'>
          <div class='box header-icon-container'>
            {{#if this.loadCardIcon.isRunning}}
              <LoadingIndicator />
            {{else if this.icon}}
              <this.icon width='35' height='35' role='presentation' />
            {{else}}
              <this.defaultIcon width='35' height='35' role='presentation' />
            {{/if}}
          </div>
          <div class='header-info-container'>
            <h1 class='title' data-test-title><@fields.title /></h1>
            <p class='description' data-test-description>
              <@fields.description />
            </p>
          </div>
        </header>
        <section class='readme section'>
          <header class='row-header'>
            <BookOpenText width='20' height='20' role='presentation' />
            <h2>Read Me</h2>
          </header>
          <@fields.readMe />
        </section>
        <section class='examples section'>
          <header class='row-header'>
            <LayersSubtract width='20' height='20' role='presentation' />
            <h2>Examples</h2>
          </header>
          {{#if (eq @model.specType 'field')}}
            <@fields.containedExamples />
          {{else}}
            <@fields.linkedExamples />
          {{/if}}
        </section>
        <section class='module section'>
          <header class='row-header'>
            <GitBranch width='20' height='20' role='presentation' />
            <h2>Module</h2>
          </header>
          <div class='code-ref-container'>
            <FieldContainer @label='URL' @vertical={{true}}>
              <div class='code-ref-row'>
                <RealmIcon class='realm-icon' @realmInfo={{this.realmInfo}} />
                <span class='code-ref-value' data-test-module-href>
                  {{@model.moduleHref}}
                </span>
              </div>
            </FieldContainer>
            <FieldContainer @label='Module Name' @vertical={{true}}>
              <div class='code-ref-row'>
                <ExportArrow class='exported-arrow' width='10' height='10' />
                <div class='code-ref-value' data-test-exported-name>
                  {{@model.ref.name}}
                </div>
                <div class='exported-type' data-test-exported-type>
                  {{@model.specType}}
                </div>
              </div>
            </FieldContainer>
          </div>
        </section>
      </article>
      <style scoped>
        .container {
          --boxel-spec-background-color: #ebeaed;
          --boxel-spec-code-ref-background-color: #e2e2e2;
          --boxel-spec-code-ref-text-color: #646464;

          height: 100%;
          min-height: max-content;
          padding: var(--boxel-sp);
          background-color: var(--boxel-spec-background-color);
        }
        .section {
          margin-top: var(--boxel-sp);
          padding-top: var(--boxel-sp);
          border-top: 1px solid var(--boxel-400);
        }
        h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          letter-spacing: var(--boxel-lsp-xs);
          line-height: 1.2;
        }
        h2 {
          margin: 0;
          font: 600 var(--boxel-font-sm);
          letter-spacing: var(--boxel-lsp-xs);
        }
        p {
          margin-top: var(--boxel-sp-4xs);
          margin-bottom: 0;
        }
        .title,
        .description {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
          text-wrap: pretty;
        }
        .box {
          border: 1px solid var(--boxel-border-color);
          border-radius: var(--boxel-border-radius-lg);
          background-color: var(--boxel-light);
        }
        .header {
          display: flex;
          gap: var(--boxel-sp-sm);
        }
        .header-icon-container {
          flex-shrink: 0;
          height: var(--boxel-icon-xxl);
          width: var(--boxel-icon-xxl);
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--boxel-100);
        }
        .header-info-container {
          align-self: center;
        }
        .row-header {
          display: flex;
          align-items: center;
          gap: var(--boxel-sp-xs);
          padding-bottom: var(--boxel-sp-lg);
        }
        .row-content {
          margin-top: var(--boxel-sp-sm);
        }

        /* code ref container styles */
        .code-ref-container {
          display: flex;
          flex-direction: column;
          gap: var(--boxel-sp-xs);
        }
        .code-ref-row {
          display: flex;
          align-items: center;
          gap: var(--boxel-sp-xs);
          min-height: var(--boxel-form-control-height);
          padding: var(--boxel-sp-xs);
          background-color: var(
            --boxel-spec-code-ref-background-color,
            var(--boxel-100)
          );
          border: var(--boxel-border);
          border-radius: var(--boxel-border-radius);
          color: var(--boxel-spec-code-ref-text-color, var(--boxel-450));
        }
        .code-ref-value {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .exported-type {
          margin-left: auto;
          color: var(--boxel-450);
          font: 500 var(--boxel-font-xs);
          letter-spacing: var(--boxel-lsp);
          text-transform: uppercase;
        }
        .exported-arrow {
          min-width: 8px;
          min-height: 8px;
        }
        .realm-icon {
          width: 18px;
          height: 18px;
          border: 1px solid var(--boxel-dark);
        }
      </style>
    </template>
  };

  static embedded = class Embedded extends Component<typeof this> {
    get icon() {
      return this.args.model.constructor?.icon;
    }
    <template>
      <div class='header'>
        <div class='header-icon-container'>
          <this.icon class='box header-icon-svg' />
        </div>
        <div class='header-info-container'>
          <header class='title'><@fields.title /></header>
          <p class='description'><@fields.description /></p>
        </div>
        <div class='pill-container'>
          {{#if @model.specType}}
            <SpecTag @specType={{@model.specType}} />
          {{/if}}
        </div>
      </div>
      <style scoped>
        .header {
          display: flex;
          align-items: center;
          gap: var(--boxel-sp-sm);
        }
        .header-icon-container {
          flex-shrink: 0;
          padding: var(--boxel-sp-sm);
        }
        .header-info-container {
          flex: 1;
        }
        .pill-container {
          padding-right: var(--boxel-sp-sm);
        }
        .header-icon-svg {
          width: 50px;
          height: 50px;
          border: 2px solid var(--boxel-border-color);
          border-radius: var(--boxel-border-radius-lg);
        }
        .title {
          font: 600 var(--boxel-font-sm);
        }
        .description {
          margin: 0;
          color: var(--boxel-500);
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
    <style scoped>
      .entry {
        display: grid;
        gap: 3px;
        font: var(--boxel-font-sm);
        margin-top: auto;
        margin-bottom: auto;
        margin-left: var(--boxel-sp-xs);
      }
    </style>
  </template>
}

interface SpecTagSignature {
  Element: HTMLDivElement;
  Args: {
    specType: string;
  };
}

export class SpecTag extends GlimmerComponent<SpecTagSignature> {
  get icon() {
    return getIcon(this.args.specType);
  }
  <template>
    {{#if this.icon}}
      <Pill class='spec-tag-pill' ...attributes>
        <:iconLeft>
          <div>
            {{this.icon}}
          </div>
        </:iconLeft>
        <:default>
          {{@specType}}
        </:default>
      </Pill>

    {{/if}}
    <style scoped>
      .spec-tag-pill {
        --pill-font: 500 var(--boxel-font-xs);
        --pill-background-color: var(--boxel-200);
      }
    </style>
  </template>
}

function getIcon(specType: string) {
  switch (specType) {
    case 'card':
      return StackIcon;
    case 'app':
      return AppsIcon;
    case 'field':
      return LayoutList;
    case 'skill':
      return Brain;
    default:
      return;
  }
}

function myLoader(): Loader {
  // we know this code is always loaded by an instance of our Loader, which sets
  // import.meta.loader.

  // When type-checking realm-server, tsc sees this file and thinks
  // it will be transpiled to CommonJS and so it complains about this line. But
  // this file is always loaded through our loader and always has access to import.meta.
  // @ts-ignore
  return (import.meta as any).loader;
}
