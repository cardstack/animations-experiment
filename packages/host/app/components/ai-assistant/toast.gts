import { on } from '@ember/modifier';
import { action } from '@ember/object';

import { later } from '@ember/runloop';
import { Timer } from '@ember/runloop';
import { service } from '@ember/service';
import { htmlSafe } from '@ember/template';

import Component from '@glimmer/component';

import { format as formatDate, formatISO } from 'date-fns';

import { resource, use } from 'ember-resources';
import window from 'ember-window-mock';

import { TrackedObject } from 'tracked-built-ins/.';

import { BoxelButton } from '@cardstack/boxel-ui/components';

import { markdownToHtml } from '@cardstack/runtime-common';

import MatrixService from '@cardstack/host/services/matrix-service';

import { MessageField } from 'https://cardstack.com/base/room';

import assistantIcon from './ai-assist-icon.webp';

import { currentRoomIdPersistenceKey } from './panel';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    hide: boolean;
    onViewInChatClick: () => void;
  };
}

export default class AiAssistantToast extends Component<Signature> {
  <template>
    {{#if this.isVisible}}
      <div
        class='ai-assistant-toast'
        data-test-ai-assistant-toast
        {{on 'mouseenter' this.blockResetState}}
        {{on 'mouseleave' this.unBlockResetState}}
      >
        <header class='toast-header' data-test-ai-assistant-toast-header>
          <img
            alt='AI Assistant'
            src={{assistantIcon}}
            width='20'
            height='20'
          />
          <time datetime={{formatISO this.unseenMessage.created}} class='time'>
            {{formatDate this.unseenMessage.created 'dd.MM.yyyy, h:mm aa'}}
          </time>
        </header>
        <div class='toast-content' data-test-ai-assistant-toast-content>
          {{htmlSafe (markdownToHtml this.unseenMessage.formattedMessage)}}
        </div>
        <BoxelButton
          @kind='secondary-dark'
          @size='extra-small'
          class='view-in-chat-button'
          {{on 'click' this.viewInChat}}
          data-test-ai-assistant-toast-button
        >
          View in chat
        </BoxelButton>
      </div>
    {{/if}}
    <style>
      .ai-assistant-toast {
        display: flex;
        flex-direction: column;
        gap: var(--boxel-sp);
        background-color: var(--boxel-ai-purple);
        border-radius: var(--boxel-border-radius);
        padding: var(--boxel-sp);
        max-width: 250px;
        overflow: ellipsis;

        position: absolute;
        bottom: calc(
          var(--boxel-sp) + var(--container-button-size) + var(--boxel-sp)
        );
        right: calc(var(--boxel-sp));
      }
      .toast-header {
        display: flex;
        align-items: center;
        gap: var(--boxel-sp-xs);
      }
      .time {
        display: block;
        font: 500 var(--boxel-font-xs);
        letter-spacing: var(--boxel-lsp-sm);
        color: var(--boxel-450);
        white-space: nowrap;
      }
      .toast-content {
        color: var(--boxel-light);
        font-size: var(--boxel-font-sm);
        font-weight: 500;
        line-height: 1.25rem;
        letter-spacing: var(--boxel-lsp-xs);
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
      }
      .view-in-chat-button {
        --boxel-button-font: 700 var(--boxel-font-xs);
        --boxel-button-min-height: 1.5rem;
        --boxel-button-padding: 0 var(--boxel-sp-xs);
        min-width: initial;
        width: fit-content;
        max-height: 1.5rem;
        margin-left: auto;
      }
      .view-in-chat-button:hover {
        filter: brightness(1.1);
      }
    </style>
  </template>

  @service private declare matrixService: MatrixService;

  @use private state = resource(({ on }) => {
    const state: {
      value: {
        roomId: string;
        message: MessageField;
      } | null;
      isResetStateBlocked: boolean;
    } = new TrackedObject({
      value: null,
      isResetStateBlocked: false,
    });

    let resetStateId: Timer | null;
    const resetState = function (timeout = 3000): Timer {
      return later(() => {
        if (state.isResetStateBlocked) {
          resetStateId = resetState(1000);
          return;
        }
        state.value = null;
      }, timeout);
    };

    let lastMessages: Map<string, MessageField> = new Map();
    for (let resource of this.matrixService.roomResources.values()) {
      if (!resource.room) {
        continue;
      }
      let { room } = resource;
      lastMessages.set(room.roomId, room.messages[room.messages.length - 1]);
    }

    let lastMessage =
      Array.from(lastMessages).filter(
        (lastMessage) =>
          lastMessage[1] &&
          !this.matrixService.currentUserEventReadReceipts.has(
            lastMessage[1].eventId,
          ),
      )[0] ?? null;
    if (lastMessage) {
      state.value = {
        roomId: lastMessage[0],
        message: lastMessage[1],
      };

      resetStateId = resetState();
      on.cleanup(() => {
        if (resetStateId) {
          clearInterval(resetStateId);
        }
      });
    }

    return state;
  });

  get roomId() {
    return this.state.value?.roomId ?? '';
  }

  get unseenMessage() {
    return this.state.value?.message ?? ({} as MessageField);
  }

  get isVisible() {
    return this.state.value && !this.args.hide;
  }

  @action
  blockResetState() {
    this.state.isResetStateBlocked = true;
  }

  @action
  unBlockResetState() {
    this.state.isResetStateBlocked = false;
  }

  @action
  private viewInChat() {
    window.localStorage.setItem(currentRoomIdPersistenceKey, this.roomId);
    this.args.onViewInChatClick();
  }
}
