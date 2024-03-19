import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { action } from '@ember/object';
import { service } from '@ember/service';
import { htmlSafe } from '@ember/template';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import { task } from 'ember-concurrency';

import { marked } from 'marked';

import { Button } from '@cardstack/boxel-ui/components';
import { eq } from '@cardstack/boxel-ui/helpers';

import { sanitizeHtml } from '@cardstack/runtime-common';

import monacoModifier from '@cardstack/host/modifiers/monaco';
import type { MonacoEditorOptions } from '@cardstack/host/modifiers/monaco';
import type MonacoService from '@cardstack/host/services/monaco-service';
import type { MonacoSDK } from '@cardstack/host/services/monaco-service';
import type OperatorModeStateService from '@cardstack/host/services/operator-mode-state-service';

import { type CardDef } from 'https://cardstack.com/base/card-api';
import { type MessageField } from 'https://cardstack.com/base/room';

import ApplyButton from '../ai-assistant/apply-button';
import AiAssistantMessage from '../ai-assistant/message';
import { aiBotUserId } from '../ai-assistant/panel';
import ProfileAvatarIcon from '../operator-mode/profile-avatar-icon';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    message: MessageField;
  };
}

export default class Room extends Component<Signature> {
  <template>
    <AiAssistantMessage
      @formattedMessage={{htmlSafe this.formattedMessage}}
      @datetime={{@message.created}}
      @isFromAssistant={{eq @message.author.userId aiBotUserId}}
      @profileAvatar={{component
        ProfileAvatarIcon
        userId=@message.author.userId
      }}
      @attachedCards={{this.resources.cards}}
      @errorMessage={{this.errorMessage}}
      data-test-boxel-message-from={{@message.author.name}}
      ...attributes
    >
      {{#if (eq @message.command.commandType 'patch')}}
        <div
          class='patch-button-bar'
          data-test-patch-card-idle={{this.operatorModeStateService.patchCard.isIdle}}
        >
          {{#let @message.command.payload as |payload|}}
            <Button
              class='view-code-button'
              {{on 'click' this.viewCodeToggle}}
              @kind={{if this.isDisplayingCode 'primary-dark' 'secondary-dark'}}
              @size='extra-small'
            >
              {{if this.isDisplayingCode 'Hide Code' 'View Code'}}
            </Button>
            <ApplyButton
              @state={{if
                this.operatorModeStateService.patchCard.isRunning
                'applying'
                'ready'
              }}
              data-test-command-apply
              {{on
                'click'
                (fn this.patchCard payload.id payload.patch.attributes)
              }}
            />
          {{/let}}
        </div>
        {{#if this.isDisplayingCode}}
          <div
            class='monaco-container'
            {{monacoModifier
              content=this.previewPatchCode
              contentChanged=undefined
              monacoSDK=this.monacoSDK
              language='json'
              readOnly=true
              darkTheme=true
              editorDisplayOptions=this.editorDisplayOptions
            }}
            data-test-view-code-panel
            data-test-percy-hide
          ></div>
        {{/if}}
      {{/if}}
    </AiAssistantMessage>

    <style>
      .patch-button-bar {
        display: flex;
        justify-content: flex-end;
        gap: var(--boxel-sp-xs);
        margin-top: var(--boxel-sp);
      }
      .view-code-button {
        --boxel-button-font: 700 var(--boxel-font-xs);
        --boxel-button-min-height: 1.5rem;
        --boxel-button-padding: 0 var(--boxel-sp-xs);
        min-width: initial;
        width: auto;
        max-height: 1.5rem;
      }
      .monaco-container {
        height: 13rem;
      }
    </style>
  </template>

  editorDisplayOptions: MonacoEditorOptions = {
    wordWrap: 'on',
    wrappingIndent: 'indent',
    fontWeight: 'bold',
  };

  @service private declare monacoService: MonacoService;
  @service private declare operatorModeStateService: OperatorModeStateService;

  @tracked private isDisplayingCode = false;
  @tracked private maybeMonacoSDK: MonacoSDK | undefined;

  private get formattedMessage() {
    return sanitizeHtml(marked(this.args.message.formattedMessage));
  }

  private get resources() {
    let cards: CardDef[] = [];
    let errors: { id: string; error: Error }[] = [];
    this.args.message.attachedResources?.map((resource) => {
      if (resource.card) {
        cards.push(resource.card);
      } else if (resource.cardError) {
        let { id, error } = resource.cardError;
        errors.push({
          id,
          error,
        });
      }
    });
    return {
      cards: cards.length ? cards : undefined,
      errors: errors.length ? errors : undefined,
    };
  }

  private get errorMessage() {
    if (!this.resources.errors) {
      return undefined;
    }
    return this.resources.errors
      .map(
        (e: { id: string; error: Error }) =>
          `cannot render card ${e.id}: ${e.error.message}`,
      )
      .join(', ');
  }

  private loadMonaco = task(async () => {
    this.maybeMonacoSDK = await this.monacoService.getMonacoContext();
  });

  private get monacoSDK() {
    if (this.maybeMonacoSDK) {
      return this.maybeMonacoSDK;
    }
    throw new Error(`cannot use monaco SDK before it has loaded`);
  }

  private get previewPatchCode() {
    return JSON.stringify(
      this.args.message.command.payload.patch.attributes,
      null,
      2,
    );
  }

  @action private async viewCodeToggle() {
    if (!this.maybeMonacoSDK && !this.isDisplayingCode) {
      await this.loadMonaco.perform();
    }
    this.isDisplayingCode = !this.isDisplayingCode;
  }

  @action patchCard(cardId: string, attributes: Record<string, unknown>) {
    if (this.operatorModeStateService.patchCard.isRunning) {
      return;
    }
    this.operatorModeStateService.patchCard.perform(cardId, attributes);
  }
}
