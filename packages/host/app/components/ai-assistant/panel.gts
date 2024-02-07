import { on } from '@ember/modifier';
import { action } from '@ember/object';
import type Owner from '@ember/owner';
import RouterService from '@ember/routing/router-service';
import { service } from '@ember/service';
import Component from '@glimmer/component';
//@ts-expect-error the types don't recognize the cached export
import { tracked, cached } from '@glimmer/tracking';

import format from 'date-fns/format';
import { restartableTask, timeout } from 'ember-concurrency';
import FromElseWhere from 'ember-elsewhere/components/from-elsewhere';
import { Velcro } from 'ember-velcro';
import { TrackedMap } from 'tracked-built-ins';

import {
  Button,
  IconButton,
  LoadingIndicator,
  FieldContainer,
  BoxelInput,
} from '@cardstack/boxel-ui/components';
import { ResizeHandle } from '@cardstack/boxel-ui/components';
import { DropdownArrowFilled, IconX } from '@cardstack/boxel-ui/icons';

import { aiBotUsername } from '@cardstack/runtime-common';

import AiAssistantPanelPopover from '@cardstack/host/components/ai-assistant/panel-popover';
import AiAssistantPastSessionsList from '@cardstack/host/components/ai-assistant/past-sessions';
import Room from '@cardstack/host/components/matrix/room';

import ENV from '@cardstack/host/config/environment';
import {
  isMatrixError,
  eventDebounceMs,
} from '@cardstack/host/lib/matrix-utils';

import type MatrixService from '@cardstack/host/services/matrix-service';
import type OperatorModeStateService from '@cardstack/host/services/operator-mode-state-service';

import type {
  RoomField,
  RoomMemberField,
} from 'https://cardstack.com/base/room';

import { getRoom, RoomResource } from '../../resources/room';

import assistantIcon from './ai-assist-icon.webp';

const { matrixServerName } = ENV;
export const aiBotUserId = `@${aiBotUsername}:${matrixServerName}`;

export type AiSessionRoom = { room: RoomField; member: RoomMemberField };

interface Signature {
  Element: HTMLDivElement;
  Args: {
    onClose: () => void;
    resizeHandle: ResizeHandle;
  };
}

export default class AiAssistantPanel extends Component<Signature> {
  <template>
    <Velcro @placement='bottom' @offsetOptions={{-50}} as |pastSessionsVelcro|>
      <div
        class='ai-assistant-panel'
        data-test-ai-assistant-panel
        ...attributes
      >
        <@resizeHandle />
        <header>
          <img alt='AI Assistant' src={{assistantIcon}} />
          <span>Assistant</span>
          <IconButton
            @variant='primary'
            @icon={{IconX}}
            @width='20px'
            @height='20px'
            class='close-ai-panel'
            {{on 'click' @onClose}}
            aria-label='Remove'
            data-test-close-ai-panel
          />
        </header>
        <div class='menu'>
          <div class='buttons'>
            <Button
              @kind='secondary-dark'
              @size='small'
              class='new-session-button'
              {{on 'click' this.createNewSession}}
              data-test-create-room-btn
            >
              New Session
            </Button>

            {{#if this.loadRoomsTask.isRunning}}
              <LoadingIndicator @color='var(--boxel-light)' />
            {{else}}
              <Button
                @kind='secondary-dark'
                @size='small'
                {{on 'click' this.displayPastSessions}}
                data-test-past-sessions-button
                class='past-sessions-button'
                {{pastSessionsVelcro.hook}}
              >
                Past Sessions
                <DropdownArrowFilled width='10' height='10' />
              </Button>
            {{/if}}
          </div>

          {{#if this.isShowingPastSessions}}
            <AiAssistantPanelPopover
              {{pastSessionsVelcro.loop}}
              data-test-past-sessions
            >
              <:header>
                Past Sessions
                <IconButton
                  @icon={{DropdownArrowFilled}}
                  @width='12px'
                  @height='12px'
                  {{on 'click' this.hidePastSessions}}
                  aria-label='Close Past Sessions'
                  data-test-close-past-sessions
                />
              </:header>
              <:body>
                <AiAssistantPastSessionsList
                  @sessions={{this.sortedAiSessionRooms}}
                  @openSession={{this.enterRoom}}
                  @renameSession={{this.setupRoomRename}}
                  @deleteSession={{this.deleteRoom}}
                  @roomToDelete={{this.roomToDelete}}
                  @setRoomToDelete={{this.setRoomToDelete}}
                  @roomDeleteError={{this.roomDeleteError}}
                />
              </:body>
            </AiAssistantPanelPopover>
          {{else if this.roomToEdit}}
            <AiAssistantPanelPopover
              {{pastSessionsVelcro.loop}}
              data-test-rename-session
            >
              <:header>
                Rename Session
              </:header>
              <:body>
                <div class='rename-room'>
                  <FieldContainer
                    @label='Session Name'
                    @tag='label'
                    @vertical={{true}}
                  >
                    <BoxelInput
                      @state={{this.roomNameInputState}}
                      @value={{this.newRoomName}}
                      @errorMessage={{this.roomNameError}}
                      @onInput={{this.setNewRoomName}}
                      data-test-name-field
                    />
                  </FieldContainer>
                </div>
                <div class='rename-room-button-wrapper'>
                  <Button
                    @kind='secondary'
                    @size='small'
                    {{on 'click' this.resetRoomRename}}
                    data-test-cancel-name-button
                  >
                    Cancel
                  </Button>
                  <Button
                    @kind='primary'
                    @size='small'
                    @disabled={{this.isSaveRenameDisabled}}
                    @loading={{this.doRenameRoom.isRunning}}
                    {{on 'click' this.renameRoom}}
                    data-test-save-name-button
                  >
                    Save
                  </Button>
                </div>
              </:body>
            </AiAssistantPanelPopover>
          {{/if}}
        </div>

        {{#if this.doCreateRoom.isRunning}}
          <LoadingIndicator
            class='create-new-loading'
            @color='var(--boxel-light)'
          />
        {{else if this.currentRoomId}}
          <Room @roomId={{this.currentRoomId}} />
        {{/if}}
      </div>
    </Velcro>
    {{#if this.roomToDelete}}
      <FromElseWhere @name='delete-modal' />
    {{/if}}

    <style>
      .ai-assistant-panel {
        display: grid;
        grid-template-rows: auto auto 1fr;
        background-color: var(--boxel-ai-purple);
        border: none;
        color: var(--boxel-light);
        height: 100%;
        position: relative;
      }
      :deep(.arrow) {
        display: none;
      }
      :deep(.separator-horizontal) {
        min-width: calc(
          var(--boxel-panel-resize-handler-width) +
            calc(var(--boxel-sp-xxxs) * 2)
        );
        position: absolute;
        left: 0;
        height: 100%;
      }
      :deep(.separator-horizontal:not(:hover) > button) {
        display: none;
      }
      :deep(.room-info) {
        padding: var(--boxel-sp) var(--boxel-sp-lg);
      }
      :deep(.ai-assistant-conversation) {
        padding: var(--boxel-sp) var(--boxel-sp-lg);
      }
      :deep(.room-actions) {
        z-index: 1;
      }
      .ai-assistant-panel header {
        align-items: center;
        display: flex;
        padding: var(--boxel-sp-xs) calc(var(--boxel-sp) / 2) var(--boxel-sp-xs)
          var(--boxel-sp-lg);
        gap: var(--boxel-sp-xs);
      }
      .ai-assistant-panel header img {
        height: 20px;
        width: 20px;
      }
      .ai-assistant-panel header span {
        font: 700 var(--boxel-font);
      }
      .menu {
        padding: var(--boxel-sp-xs) var(--boxel-sp-lg);
        position: relative;
      }
      .buttons {
        align-items: center;
        display: flex;
      }
      .new-session-button {
        margin-right: var(--boxel-sp-xxxs);
      }

      .close-ai-panel {
        --icon-color: var(--boxel-highlight);
        margin-left: auto;
      }

      .past-sessions-button svg {
        --icon-color: var(--boxel-light);
        margin-left: var(--boxel-sp-xs);
      }
      .room-list {
        padding: 0;
      }

      .create-new-loading {
        padding: var(--boxel-sp);
      }

      .rename-room {
        padding: 0 var(--boxel-sp);
      }
      .rename-room :deep(.label) {
        font: 700 var(--boxel-font-sm);
      }
      .rename-room-button-wrapper {
        display: flex;
        justify-content: flex-end;
        gap: var(--boxel-sp-xs);
        padding: var(--boxel-sp);
      }
      .rename-room-button-wrapper :deep(.boxel-button:not(:disabled)) {
        --boxel-button-text-color: var(--boxel-dark);
      }
    </style>
  </template>

  @service private declare matrixService: MatrixService;
  @service private declare operatorModeStateService: OperatorModeStateService;
  @service private declare router: RouterService;

  @tracked private currentRoomId: string | undefined;
  @tracked private isShowingPastSessions = false;
  @tracked private roomToEdit: RoomField | undefined = undefined;
  @tracked private roomToDelete: RoomField | undefined = undefined;
  @tracked private newRoomName = '';
  @tracked private roomNameError: string | undefined = undefined;
  @tracked private roomDeleteError: string | undefined = undefined;

  constructor(owner: Owner, args: Signature['Args']) {
    super(owner, args);
    this.loadRoomsTask.perform();
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
    if (!this.currentRoomId) {
      let lastestRoom = this.sortedAiSessionRooms[0];
      this.enterRoom(lastestRoom?.room.roomId);
    }
  });

  @action
  private createNewSession() {
    let newRoomName = `${format(
      new Date(),
      "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
    )} - ${this.matrixService.userId}`;
    let newRoomInvite = [aiBotUsername];
    this.doCreateRoom.perform(newRoomName, newRoomInvite);
  }

  private doCreateRoom = restartableTask(
    async (newRoomName: string, newRoomInvite: string[]) => {
      let newRoomId = await this.matrixService.createRoom(
        newRoomName,
        newRoomInvite,
      );
      this.enterRoom(newRoomId);
    },
  );

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
    let rooms: AiSessionRoom[] = [];
    for (let resource of this.roomResources.values()) {
      if (!resource.room) {
        continue;
      }
      if (resource.room.roomMembers.find((m) => aiBotUserId === m.userId)) {
        let roomMember = resource.room.joinedMembers.find(
          (m) => this.matrixService.userId === m.userId,
        );
        if (roomMember) {
          rooms.push({ room: resource.room, member: roomMember });
        }
      }
    }
    return rooms;
  }

  @cached
  private get sortedAiSessionRooms() {
    // reverse chronological order
    return this.aiSessionRooms.sort(
      (a, b) =>
        b.member.membershipDateTime.getTime() -
        a.member.membershipDateTime.getTime(),
    );
  }

  @action
  private enterRoom(roomId: string) {
    this.currentRoomId = roomId;
    this.hidePastSessions();
  }

  // Room rename
  @action private setupRoomRename(room: RoomField) {
    this.roomToEdit = room;
    this.newRoomName = room.name;
    this.hidePastSessions();
  }

  @action private resetRoomRename() {
    this.roomNameError = undefined;
    this.newRoomName = '';
    this.roomToEdit = undefined;
  }

  private get roomNameInputState() {
    return this.roomNameError ? 'invalid' : 'initial';
  }

  @action
  private setNewRoomName(name: string) {
    this.roomNameError = undefined;
    this.newRoomName = name;
  }

  private get isSaveRenameDisabled() {
    return (
      !this.newRoomName?.length ||
      this.newRoomName === this.roomToEdit?.name ||
      this.doRenameRoom.isRunning
    );
  }

  @action private renameRoom() {
    this.doRenameRoom.perform();
  }

  private doRenameRoom = restartableTask(async () => {
    if (!this.newRoomName.length || !this.roomToEdit) {
      throw new Error(`bug: should never get here`);
    }
    try {
      await this.matrixService.client.setRoomName(
        this.roomToEdit.roomId,
        this.newRoomName,
      );
      this.resetRoomRename();
    } catch (e) {
      if (isMatrixError(e) && e.data.errcode === 'M_FORBIDDEN') {
        this.roomNameError = `You don't have permission to rename this room`;
        return;
      } else if (isMatrixError(e)) {
        this.roomNameError = `Error renaming room: ${e.data.error}`;
        return;
      }
      throw e;
    }
  });

  // Room deletion
  @action private setRoomToDelete(room: RoomField | undefined) {
    this.roomDeleteError = undefined;
    this.roomToDelete = room;
  }

  @action
  private deleteRoom(roomId: string) {
    this.doDeleteRoom.perform(roomId);
  }

  private doDeleteRoom = restartableTask(async (roomId: string) => {
    try {
      await this.matrixService.client.leave(roomId);
      await timeout(eventDebounceMs); // this makes it feel a bit more responsive
      this.roomToDelete = undefined;
      if (this.currentRoomId === roomId) {
        this.currentRoomId = this.sortedAiSessionRooms[0]?.room.roomId;
      }
      this.hidePastSessions();
    } catch (e) {
      if (isMatrixError(e) && e.data.errcode === 'M_FORBIDDEN') {
        this.roomDeleteError = `You don't have permission to delete this room`;
        return;
      } else if (isMatrixError(e)) {
        this.roomDeleteError = `Error deleting room: ${e.data.error}`;
        return;
      }
      throw e;
    }
  });
}
