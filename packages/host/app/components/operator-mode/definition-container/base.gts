import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { on } from '@ember/modifier';

import { service } from '@ember/service';
import Component from '@glimmer/component';

import {
  Button,
  CardContainer,
  Header,
  Label,
} from '@cardstack/boxel-ui/components';

import type { Icon } from '@cardstack/boxel-ui/icons';

import RealmIcon from '@cardstack/host/components/operator-mode/realm-icon';
import type RealmService from '@cardstack/host/services/realm';

interface Action {
  label: string;
  handler: (args: any) => void | Promise<void>; // TODO: narrow this for each type of module
  icon: Icon;
}
export interface BaseArgs {
  title: string | undefined;
  name: string | undefined;
  fileExtension: string | undefined;
  isActive: boolean;
  fileURL?: string;
}

interface BaseSignature {
  Element: HTMLElement;
  Args: BaseArgs;
  Blocks: {
    activeContent: [];
  };
}

class BaseDefinitionContainer extends Component<BaseSignature> {
  @service private declare realm: RealmService;

  <template>
    <CardContainer class='card-container' ...attributes>
      <Header
        @title={{@title}}
        @hasBackground={{true}}
        class='header {{if @isActive "active"}}'
        data-test-definition-header
      >
        <:detail>
          <div data-test-definition-file-extension>
            {{@fileExtension}}
          </div>
        </:detail>
      </Header>
      <div class='content'>
        <div class='definition-info'>
          {{#if @fileURL}}
            {{#let (this.realm.info @fileURL) as |realmInfo|}}
              <div class='realm-info'>
                <RealmIcon @realmInfo={{realmInfo}} />
                <Label class='realm-name' data-test-definition-realm-name>in
                  {{realmInfo.name}}</Label>
              </div>
            {{/let}}
          {{/if}}
          <div data-test-definition-name class='definition-name'>{{@name}}</div>

        </div>
        {{#if @isActive}}
          {{yield to='activeContent'}}
        {{/if}}
      </div>
    </CardContainer>

    <style scoped>
      .card-container {
        overflow: hidden;
        overflow-wrap: anywhere;
      }
      .header {
        --boxel-header-text-font: var(--boxel-font-size-sm);
        --boxel-header-padding: var(--boxel-sp-xs);
        --boxel-header-text-transform: uppercase;
        --boxel-header-letter-spacing: var(--boxel-lsp-xxl);
        --boxel-header-detail-max-width: none;
        --boxel-header-background-color: var(--boxel-100);
        --boxel-header-text-color: var(--boxel-450);
        --boxel-header-max-width: calc(100% - 10rem);
      }

      .header.active {
        --boxel-header-background-color: var(--boxel-highlight);
        --boxel-header-text-color: var(--boxel-light);
      }
      .content {
        display: flex;
        flex-direction: column;
        padding: var(--boxel-sp-xs);
        gap: var(--boxel-sp-sm);
      }
      .realm-info {
        display: flex;
        justify-content: flex-start;
        align-items: center;
        gap: var(--boxel-sp-xxxs);
      }
      .realm-info img {
        width: var(--boxel-icon-sm);
      }
      .realm-info .realm-name {
        letter-spacing: var(--boxel-lsp-xs);
        font-weight: 500;
        font-size: var(--boxel-font-size-sm);
      }
      .definition-info {
        display: flex;
        flex-direction: column;
        gap: var(--boxel-sp-xxxs);
      }
      .definition-name {
        font-size: var(--boxel-font-size);
        font-weight: bold;
      }
    </style>
  </template>
}

export interface ActiveArgs {
  actions: Action[];
  infoText?: string;
}

interface ActiveSignature {
  Element: HTMLElement;
  Args: ActiveArgs;
}

const Active: TemplateOnlyComponent<ActiveSignature> = <template>
  <div class='action-buttons'>
    {{#each @actions as |actionButton|}}
      <Button
        data-test-action-button='{{actionButton.label}}'
        class='action-button'
        @size='small'
        @kind='text-only'
        {{on 'click' actionButton.handler}}
      >
        <actionButton.icon width='20px' height='20px' />
        {{actionButton.label}}
      </Button>
    {{/each}}
    <div
      class='info-footer'
      data-test-definition-info-text
      data-test-percy-hide
    >
      <div class='message'>{{@infoText}}</div>
    </div>
  </div>
  <style scoped>
    .action-buttons {
      display: grid;
      grid-auto-columns: max-content;
      gap: var(--boxel-sp-4xs);
    }
    .action-button {
      --boxel-button-padding: 0 var(--boxel-sp-4xs);
      --icon-color: var(--boxel-highlight);
      justify-content: flex-start;
      gap: var(--boxel-sp-xxs);
      align-self: flex-start;
    }
    .action-button:hover:not(:disabled) {
      --icon-color: var(--boxel-highlight-hover);
    }
    .info-footer {
      margin-top: var(--boxel-sp-sm);
    }
    .info-footer .message {
      color: var(--boxel-450);
      font: var(--boxel-font-xs);
      font-weight: 500;
    }
  </style>
</template>;

export { Active, BaseDefinitionContainer };
