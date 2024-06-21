import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { on } from '@ember/modifier';
import { service } from '@ember/service';
import type { SafeString } from '@ember/template';
import Component from '@glimmer/component';

import { format as formatDate, formatISO } from 'date-fns';
import Modifier from 'ember-modifier';

import { Button } from '@cardstack/boxel-ui/components';
import { cn } from '@cardstack/boxel-ui/helpers';
import { FailureBordered } from '@cardstack/boxel-ui/icons';

import CardPill from '@cardstack/host/components/card-pill';

import type CardService from '@cardstack/host/services/card-service';

import { type CardDef } from 'https://cardstack.com/base/card-api';

import type { ComponentLike } from '@glint/template';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    formattedMessage: SafeString;
    datetime: Date;
    isFromAssistant: boolean;
    isStreaming: boolean;
    profileAvatar?: ComponentLike;
    resources?: {
      cards: CardDef[] | undefined;
      errors: { id: string; error: Error }[] | undefined;
    };
    errorMessage?: string;
    isPending?: boolean;
    retryAction?: () => void;
  };
  Blocks: { default: [] };
}

class ScrollIntoView extends Modifier {
  modify(element: HTMLElement) {
    element.scrollIntoView();
  }
}

export default class AiAssistantMessage extends Component<Signature> {
  @service private declare cardService: CardService;

  <template>
    <div
      class={{cn
        'ai-assistant-message'
        is-from-assistant=@isFromAssistant
        is-pending=@isPending
        is-error=@errorMessage
      }}
      {{ScrollIntoView}}
      data-test-ai-assistant-message
      ...attributes
    >
      <div class='meta'>
        {{#if @isFromAssistant}}
          <div
            class='ai-avatar {{if this.isAvatarAnimated "ai-avatar-animated"}}'
            data-test-ai-avatar
          ></div>
        {{else if @profileAvatar}}
          <@profileAvatar />
        {{/if}}
        <time datetime={{formatISO @datetime}} class='time'>
          {{formatDate @datetime 'iiii MMM d, yyyy, h:mm aa'}}
        </time>
      </div>
      <div class='content-container'>
        {{#if @errorMessage}}
          <div class='error-container'>
            <FailureBordered class='error-icon' />
            <div class='error-message' data-test-card-error>
              {{@errorMessage}}
            </div>

            {{#if @retryAction}}
              <Button
                {{on 'click' @retryAction}}
                class='retry-button'
                @size='small'
                @kind='secondary-dark'
                data-test-ai-bot-retry-button
              >
                Retry
              </Button>
            {{/if}}
          </div>
        {{/if}}

        <div class='content' data-test-ai-message-content>
          {{@formattedMessage}}

          {{yield}}

          {{#if @resources.cards.length}}
            <div class='cards' data-test-message-cards>
              {{#each @resources.cards as |card|}}
                <CardPill @card={{card}} />
              {{/each}}
            </div>
          {{/if}}

          {{#if @resources.errors.length}}
            <div class='error-container'>
              {{#each @resources.errors as |resourceError|}}
                <FailureBordered class='error-icon' />
                <div class='error-message' data-test-card-error>
                  <div>Cannot render {{resourceError.id}}</div>
                </div>
              {{/each}}
            </div>
          {{/if}}
        </div>
      </div>
    </div>

    <style>
      .ai-assistant-message {
        --ai-bot-message-background-color: #3b394b;
        --ai-assistant-message-avatar-size: 1.25rem; /* 20px. */
        --ai-assistant-message-meta-height: 1.25rem; /* 20px */
        --ai-assistant-message-gap: var(--boxel-sp-xs);
        --profile-avatar-icon-size: var(--ai-assistant-message-avatar-size);
        --profile-avatar-icon-border: 1px solid var(--boxel-400);
      }
      .meta {
        display: grid;
        grid-template-columns: var(--ai-assistant-message-avatar-size) 1fr;
        grid-template-rows: var(--ai-assistant-message-meta-height);
        align-items: center;
        gap: var(--ai-assistant-message-gap);
      }
      .ai-avatar {
        width: var(--ai-assistant-message-avatar-size);
        height: var(--ai-assistant-message-avatar-size);

        background-image: image-set(
          url('../ai-assist-icon.webp') 1x,
          url('../ai-assist-icon@2x.webp') 2x,
          url('../ai-assist-icon@3x.webp')
        );
        background-repeat: no-repeat;
        background-size: var(--ai-assistant-message-avatar-size);
      }

      .ai-avatar-animated {
        background-image: url('../ai-assist-icon-animated.webp');
      }

      .avatar-img {
        width: var(--ai-assistant-message-avatar-size);
        height: var(--ai-assistant-message-avatar-size);
        border-radius: 100px;
      }

      .time {
        display: block;
        font: 500 var(--boxel-font-xs);
        letter-spacing: var(--boxel-lsp-sm);
        color: var(--boxel-450);
        white-space: nowrap;
      }

      /* spacing for sequential thread messages */
      .ai-assistant-message + .ai-assistant-message {
        margin-top: var(--boxel-sp-lg);
      }

      .ai-assistant-message + .hide-meta {
        margin-top: var(--boxel-sp);
      }

      .content-container {
        margin-top: var(--boxel-sp-xs);
        border-radius: var(--boxel-border-radius-xs)
          var(--boxel-border-radius-xl) var(--boxel-border-radius-xl)
          var(--boxel-border-radius-xl);
        overflow: hidden;
      }

      .content {
        background-color: var(--boxel-light);
        color: var(--boxel-dark);
        font-size: var(--boxel-font-sm);
        font-weight: 500;
        line-height: 1.25rem;
        letter-spacing: var(--boxel-lsp-xs);
        padding: var(--ai-assistant-message-padding, var(--boxel-sp));
      }
      .is-from-assistant .content {
        background-color: var(--ai-bot-message-background-color);
        color: var(--boxel-light);
        /* the below font-smoothing options are only recommended for light-colored
          text on dark background (otherwise not good for accessibility) */
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      .is-pending .content,
      .is-pending .content .cards > :deep(.card-pill),
      .is-pending .content .cards > :deep(.card-pill .boxel-card-container) {
        background: var(--boxel-200);
        color: var(--boxel-500);
      }

      .is-error .content,
      .is-error .content .cards > :deep(.card-pill),
      .is-error .content .cards > :deep(.card-pill .boxel-card-container) {
        background: var(--boxel-200);
        color: var(--boxel-500);
        max-height: 300px;
        overflow: auto;
      }

      .content > :deep(.patch-message) {
        font-weight: 700;
        letter-spacing: var(--boxel-lsp-sm);
      }

      .content > :deep(*) {
        margin-top: 0;
        margin-bottom: 0;
      }
      .content > :deep(* + *) {
        margin-top: var(--boxel-sp);
      }

      .error-container {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: var(--boxel-sp-xs);
        padding: var(--boxel-sp-xs) var(--boxel-sp-sm);
        background-color: var(--boxel-danger);
        color: var(--boxel-light);
        font: 700 var(--boxel-font-sm);
        letter-spacing: var(--boxel-lsp);
      }
      .error-icon {
        --icon-background-color: var(--boxel-light);
        --icon-color: var(--boxel-danger);
        margin-top: var(--boxel-sp-5xs);
      }
      .error-message {
        align-self: center;
        overflow: hidden;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }
      .retry-button {
        --boxel-button-padding: var(--boxel-sp-5xs) var(--boxel-sp-xs);
        --boxel-button-min-height: max-content;
        --boxel-button-min-width: max-content;
        border-color: var(--boxel-light);
      }

      .cards {
        color: var(--boxel-dark);
        display: flex;
        flex-wrap: wrap;
        gap: var(--boxel-sp-xxs);
      }
    </style>
  </template>

  private get isAvatarAnimated() {
    return this.args.isStreaming && !this.args.errorMessage;
  }
}

interface AiAssistantConversationSignature {
  Element: HTMLDivElement;
  Args: {};
  Blocks: {
    default: [];
  };
}

const AiAssistantConversation: TemplateOnlyComponent<AiAssistantConversationSignature> =
  <template>
    <div class='ai-assistant-conversation' ...attributes>
      {{yield}}
    </div>
    <style>
      @layer {
        .ai-assistant-conversation {
          display: flex;
          flex-direction: column;
          padding: var(--boxel-sp);
          overflow-y: auto;
        }
      }
    </style>
  </template>;

export { AiAssistantConversation };
