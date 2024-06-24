import { fn, hash } from '@ember/helper';
import { on } from '@ember/modifier';
import { action } from '@ember/object';
import type Owner from '@ember/owner';
import RouterService from '@ember/routing/router-service';
import { service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked, cached } from '@glimmer/tracking';

import { restartableTask, timeout } from 'ember-concurrency';
import { Velcro } from 'ember-velcro';
import window from 'ember-window-mock';
import { TrackedMap } from 'tracked-built-ins';

import {
  Button,
  IconButton,
  LoadingIndicator,
  ResizeHandle,
} from '@cardstack/boxel-ui/components';
import { not } from '@cardstack/boxel-ui/helpers';
import { DropdownArrowFilled, IconX } from '@cardstack/boxel-ui/icons';

import { aiBotUsername } from '@cardstack/runtime-common';

import NewSession from '@cardstack/host/components/ai-assistant/new-session';
import AiAssistantPastSessionsList from '@cardstack/host/components/ai-assistant/past-sessions';
import RenameSession from '@cardstack/host/components/ai-assistant/rename-session';
import Room from '@cardstack/host/components/matrix/room';
import DeleteModal from '@cardstack/host/components/operator-mode/delete-modal';

import ENV from '@cardstack/host/config/environment';
import {
  isMatrixError,
  eventDebounceMs,
} from '@cardstack/host/lib/matrix-utils';

import type MatrixService from '@cardstack/host/services/matrix-service';
import type MonacoService from '@cardstack/host/services/monaco-service';
import { type MonacoSDK } from '@cardstack/host/services/monaco-service';

import type { RoomField } from 'https://cardstack.com/base/room';

import { getRoom, RoomResource } from '../../resources/room';

import assistantIcon from './ai-assist-icon.webp';

const { matrixServerName } = ENV;
export const aiBotUserId = `@${aiBotUsername}:${matrixServerName}`;

interface Signature {
  Element: HTMLDivElement;
  Args: {
    onClose: () => void;
    resizeHandle: ResizeHandle;
  };
}

// Local storage keys
let currentRoomIdPersistenceKey = 'aiPanelCurrentRoomId';
let newSessionIdPersistenceKey = 'aiPanelNewSessionId';

export default class AiAssistantPanel extends Component<Signature> {
  get hasOtherActiveSessions() {
    let oneMinuteAgo = new Date(Date.now() - 60 * 1000).getTime();

    return this.aiSessionRooms
      .filter((session) => session.roomId !== this.currentRoom?.roomId)
      .some((session) => {
        let isSessionActive =
          this.matrixService.getLastActiveTimestamp(session) > oneMinuteAgo;

        let lastMessageEventId =
          session.messages[session.messages.length - 1]?.eventId;

        let hasSeenLastMessage =
          this.matrixService.currentUserEventReadReceipts.has(
            lastMessageEventId,
          );

        return isSessionActive && !hasSeenLastMessage;
      });
  }

  <template>
    <Velcro @placement='bottom' @offsetOptions={{-50}} as |popoverVelcro|>
      <div
        class='ai-assistant-panel'
        data-test-ai-assistant-panel
        ...attributes
      >
        <@resizeHandle />
        <header class='panel-header'>
          {{#if this.isDisplayingRoomTitle}}
            <div class='panel-title-group'>
              <img
                alt='AI Assistant'
                src={{assistantIcon}}
                width='20'
                height='20'
              />
              <h3 class='panel-title-text' data-test-chat-title>
                {{if this.currentRoom.name this.currentRoom.name 'Assistant'}}
              </h3>
            </div>
          {{/if}}
          <IconButton
            class='close-ai-panel'
            @variant='primary'
            @icon={{IconX}}
            @width='12px'
            @height='12px'
            {{on 'click' @onClose}}
            aria-label='Close AI Assistant'
            data-test-close-ai-assistant
          />
          <div class='header-buttons' {{popoverVelcro.hook}}>
            <Button
              class='new-session-button'
              @kind='secondary-dark'
              @size='small'
              @disabled={{not this.currentRoom.messages.length}}
              {{on 'click' this.createNewSession}}
              data-test-create-room-btn
            >
              New Session
            </Button>

            {{#if this.loadRoomsTask.isRunning}}
              <LoadingIndicator @color='var(--boxel-light)' />
            {{else}}
              <Button
                class='past-sessions-button
                  {{if
                    this.hasOtherActiveSessions
                    "past-sessions-button-active"
                  }}'
                @kind='secondary-dark'
                @size='small'
                @disabled={{this.displayRoomError}}
                {{on 'click' this.displayPastSessions}}
                data-test-past-sessions-button
                data-test-has-active-sessions={{this.hasOtherActiveSessions}}
              >
                All Sessions
                <DropdownArrowFilled width='10' height='10' />

              </Button>
            {{/if}}
          </div>
        </header>

        {{#if this.isShowingPastSessions}}
          <AiAssistantPastSessionsList
            @sessions={{this.aiSessionRooms}}
            @roomActions={{this.roomActions}}
            @onClose={{this.hidePastSessions}}
            @currentRoomId={{this.currentRoomId}}
            {{popoverVelcro.loop}}
          />
        {{else if this.roomToRename}}
          <RenameSession
            @room={{this.roomToRename}}
            @onClose={{this.onCloseRename}}
            {{popoverVelcro.loop}}
          />
        {{/if}}

        {{#if this.displayRoomError}}
          <div class='session-error'>
            <NewSession @errorAction={{this.createNewSession}} />
          </div>
        {{else if this.isReady}}
          {{! below if statement is covered in 'isReady' check above but added due to glint not realizing it }}
          {{#if this.currentRoomId}}
            <Room
              @roomId={{this.currentRoomId}}
              @monacoSDK={{this.monacoSDK}}
            />
          {{/if}}
        {{else}}
          <LoadingIndicator
            class='loading-new-session'
            @color='var(--boxel-light)'
          />
        {{/if}}
      </div>
    </Velcro>

    {{#if this.roomToDelete}}
      {{#let this.roomToDelete.roomId this.roomToDelete.name as |id name|}}
        <DeleteModal
          @itemToDelete={{id}}
          @onConfirm={{fn this.leaveRoom id}}
          @onCancel={{fn this.setRoomToDelete undefined}}
          @itemInfo={{hash type='room' name=(if name name id) id=id}}
          @error={{this.roomDeleteError}}
        />
      {{/let}}
    {{/if}}

    <style>
      .ai-assistant-panel {
        display: grid;
        grid-template-rows: auto 1fr;
        background-color: var(--boxel-ai-purple);
        border: none;
        border-radius: 0;
        color: var(--boxel-light);
        height: 100%;
        position: relative;
      }
      :deep(.arrow) {
        display: none;
      }
      :deep(.separator-horizontal) {
        min-width: calc(
          var(--boxel-panel-resize-handle-width) +
            calc(var(--boxel-sp-xxxs) * 2)
        );
        position: absolute;
        left: 0;
        height: 100%;
      }
      :deep(.separator-horizontal:not(:hover) > button) {
        display: none;
      }
      :deep(.room-actions) {
        z-index: 1;
      }
      .panel-header {
        --panel-title-height: 40px;
        position: relative;
        padding: var(--boxel-sp) calc(var(--boxel-sp) / 2) var(--boxel-sp)
          var(--boxel-sp-lg);
      }
      .panel-title-group {
        height: var(--panel-title-height);
        align-items: center;
        display: flex;
        gap: var(--boxel-sp-xs);
        margin-bottom: var(--boxel-sp);
      }
      .panel-title-text {
        margin: 0;
        padding-right: var(--boxel-sp-xl);
        color: var(--boxel-light);
        font: 700 var(--boxel-font);
        letter-spacing: var(--boxel-lsp);
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        /* the below font-smoothing options are only recommended for light-colored
          text on dark background (otherwise not good for accessibility) */
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      .close-ai-panel {
        --icon-color: var(--boxel-highlight);
        position: absolute;
        right: var(--boxel-sp-xs);
        top: var(--boxel-sp);
        height: var(--panel-title-height);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
      }
      .close-ai-panel:hover:not(:disabled) {
        filter: brightness(1.1);
      }
      .header-buttons {
        position: relative;
        align-items: center;
        display: inline-flex;
        height: var(--panel-title-height);
      }
      .new-session-button {
        margin-right: var(--boxel-sp-xxxs);
      }
      .past-sessions-button svg {
        --icon-color: var(--boxel-light);
        margin-left: var(--boxel-sp-xs);
      }

      .past-sessions-button-active::before {
        content: '';
        position: absolute;
        top: -105px;
        left: -55px;
        width: 250px;
        height: 250px;
        background: conic-gradient(
          #ffcc8f 0deg,
          #ff3966 45deg,
          #ff309e 90deg,
          #aa1dc9 135deg,
          #d7fad6 180deg,
          #5fdfea 225deg,
          #3d83f2 270deg,
          #5145e8 315deg,
          #ffcc8f 360deg
        );
        z-index: -1;
        animation: spin 4s infinite linear;
      }

      .past-sessions-button-active::after {
        content: '';
        position: absolute;
        top: 1px;
        left: 1px;
        right: 1px;
        bottom: 1px;
        background: var(--boxel-700);
        border-radius: inherit;
        z-index: -1;
      }

      .past-sessions-button-active {
        position: relative;
        display: inline-block;
        border-radius: 3rem;
        color: white;
        background: var(--boxel-700);
        border: none;
        cursor: pointer;
        z-index: 1;
        overflow: hidden;
      }

      .loading-new-session {
        padding: var(--boxel-sp);
      }
      .session-error {
        padding: var(--boxel-sp);
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    </style>
  </template>

  @service private declare matrixService: MatrixService;
  @service private declare monacoService: MonacoService;
  @service private declare router: RouterService;

  @tracked private currentRoomId: string | undefined;
  @tracked private isShowingPastSessions = false;
  @tracked private roomToRename: RoomField | undefined = undefined;
  @tracked private roomToDelete: RoomField | undefined = undefined;
  @tracked private roomDeleteError: string | undefined = undefined;
  @tracked private displayRoomError = false;
  @tracked private maybeMonacoSDK: MonacoSDK | undefined;

  constructor(owner: Owner, args: Signature['Args']) {
    super(owner, args);
    this.loadRoomsTask.perform();
    this.loadMonaco.perform();
  }

  private get isDisplayingRoomTitle() {
    return this.currentRoom?.messages.length && !this.displayRoomError;
  }

  private enterRoomInitially() {
    if (this.currentRoomId) {
      return;
    }

    let persistedRoomId = window.localStorage.getItem(
      currentRoomIdPersistenceKey,
    );
    if (persistedRoomId && this.roomResources.has(persistedRoomId)) {
      this.currentRoomId = persistedRoomId;
    } else {
      let latestRoom = this.aiSessionRooms[0];
      if (latestRoom) {
        this.currentRoomId = latestRoom.roomId;
      } else {
        this.createNewSession();
      }
    }
  }

  private get currentRoom() {
    return this.currentRoomId
      ? this.roomResources.get(this.currentRoomId)?.room
      : undefined;
  }

  @cached
  private get roomResources() {
    let resources = new TrackedMap<string, RoomResource>();
    for (let roomId of this.matrixService.rooms.keys()) {
      resources.set(
        roomId,
        getRoom(this, () => roomId),
      );
    }
    return resources;
  }

  private loadRoomsTask = restartableTask(async () => {
    await this.matrixService.flushMembership;
    await this.matrixService.flushTimeline;
    await Promise.all([...this.roomResources.values()].map((r) => r.loading));
    this.enterRoomInitially();
  });

  @action
  private createNewSession() {
    this.displayRoomError = false;
    if (this.newSessionId) {
      this.enterRoom(this.newSessionId!);
      return;
    }
    let newRoomName = 'New AI Assistant Chat';
    this.doCreateRoom.perform(newRoomName, [aiBotUsername]);
  }

  private doCreateRoom = restartableTask(
    async (name: string, invites: string[]) => {
      try {
        let newRoomId = await this.matrixService.createRoom(name, invites);
        window.localStorage.setItem(newSessionIdPersistenceKey, newRoomId);
        this.enterRoom(newRoomId);
      } catch (e) {
        this.displayRoomError = true;
        this.currentRoomId = undefined;
      }
    },
  );

  private get newSessionId() {
    let id = window.localStorage.getItem(newSessionIdPersistenceKey);
    if (
      id &&
      this.roomResources.has(id) &&
      this.roomResources.get(id)?.room?.messages.length === 0
    ) {
      return id;
    }
    return undefined;
  }

  @action
  private displayPastSessions() {
    this.isShowingPastSessions = true;
  }

  @action
  private hidePastSessions() {
    this.isShowingPastSessions = false;
  }

  @cached
  private get aiSessionRooms() {
    let rooms: RoomField[] = [];
    for (let resource of this.roomResources.values()) {
      if (!resource.room) {
        continue;
      }
      let { room } = resource;
      if (!room.created) {
        // there is a race condition in the matrix SDK where newly created
        // rooms don't immediately have a created date
        room.created = new Date();
      }
      if (
        (room.invitedMembers.find((m) => aiBotUserId === m.userId) ||
          room.joinedMembers.find((m) => aiBotUserId === m.userId)) &&
        room.joinedMembers.find((m) => this.matrixService.userId === m.userId)
      ) {
        rooms.push(room);
      }
    }
    // sort in reverse chronological order of last activity
    let sorted = rooms.sort(
      (a, b) =>
        this.matrixService.getLastActiveTimestamp(b) -
        this.matrixService.getLastActiveTimestamp(a),
    );
    return sorted;
  }

  @action
  private enterRoom(roomId: string, hidePastSessionsList = true) {
    this.currentRoomId = roomId;
    if (hidePastSessionsList) {
      this.hidePastSessions();
    }
    window.localStorage.setItem(currentRoomIdPersistenceKey, roomId);
  }

  @action private setRoomToRename(room: RoomField | undefined) {
    this.roomToRename = room;
    this.hidePastSessions();
  }

  @action private onCloseRename() {
    this.roomToRename = undefined;
    this.displayPastSessions();
  }

  @action private setRoomToDelete(room: RoomField | undefined) {
    this.roomDeleteError = undefined;
    this.roomToDelete = room;
  }

  private get roomActions() {
    return {
      open: this.enterRoom,
      rename: this.setRoomToRename,
      delete: this.setRoomToDelete,
    };
  }

  @action
  private leaveRoom(roomId: string) {
    this.doLeaveRoom.perform(roomId);
  }

  private doLeaveRoom = restartableTask(async (roomId: string) => {
    try {
      await this.matrixService.client.leave(roomId);
      await this.matrixService.client.forget(roomId);
      await timeout(eventDebounceMs); // this makes it feel a bit more responsive
      this.roomResources.delete(roomId);

      if (this.newSessionId === roomId) {
        window.localStorage.removeItem(newSessionIdPersistenceKey);
      }

      if (this.currentRoomId === roomId) {
        window.localStorage.removeItem(currentRoomIdPersistenceKey);
        let latestRoom = this.aiSessionRooms[0];
        if (latestRoom) {
          this.enterRoom(latestRoom.roomId, false);
        } else {
          this.createNewSession();
        }
      }
      this.roomToDelete = undefined;
    } catch (e) {
      console.error(e);
      this.roomDeleteError = 'Error deleting room';
      if (isMatrixError(e)) {
        this.roomDeleteError += `: ${e.data.error}`;
      } else if (e instanceof Error) {
        this.roomDeleteError += `: ${e.message}`;
      }
    }
  });

  private loadMonaco = restartableTask(async () => {
    this.maybeMonacoSDK = await this.monacoService.getMonacoContext();
  });

  private get monacoSDK() {
    if (this.maybeMonacoSDK) {
      return this.maybeMonacoSDK;
    }
    throw new Error(`cannot use monaco SDK before it has loaded`);
  }

  private get isReady() {
    return Boolean(
      this.currentRoomId && this.maybeMonacoSDK && this.doCreateRoom.isIdle,
    );
  }
}
