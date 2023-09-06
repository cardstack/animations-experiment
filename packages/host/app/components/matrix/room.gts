import Component from '@glimmer/component';
import { service } from '@ember/service';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
//@ts-expect-error the types don't recognize the cached export
import { tracked, cached } from '@glimmer/tracking';
import { not, and, eq } from '@cardstack/host/helpers/truth-helpers';
import { restartableTask, task, timeout, all } from 'ember-concurrency';
import {
  BoxelInput,
  LoadingIndicator,
  FieldContainer,
  Button,
} from '@cardstack/boxel-ui';
import { getRoom } from '../../resources/room';
import { TrackedMap } from 'tracked-built-ins';
import {
  chooseCard,
  baseCardRef,
  catalogEntryRef,
} from '@cardstack/runtime-common';
import { registerDestructor } from '@ember/destroyable';
import type MatrixService from '@cardstack/host/services/matrix-service';
import type OperatorModeStateService from '../../services/operator-mode-state-service';
import {
  type CardDef,
  type FieldDef,
} from 'https://cardstack.com/base/card-api';
import type CardService from '@cardstack/host/services/card-service';
import { type CatalogEntry } from 'https://cardstack.com/base/catalog-entry';
import config from '@cardstack/host/config/environment';
import { fn } from '@ember/helper';

const { environment } = config;

interface RoomArgs {
  Args: {
    roomId: string;
  };
}

export default class Room extends Component<RoomArgs> {
  <template>
    <div>Number of cards: {{this.totalCards}}</div>
    <div class='room-members'>
      <div data-test-room-members class='members'><b>Members:</b>
        {{this.memberNames}}
      </div>
      {{#unless this.isInviteMode}}
        <Button
          data-test-invite-mode-btn
          class='invite-btn'
          {{on 'click' this.showInviteMode}}
          @disabled={{this.isInviteMode}}
        >Invite</Button>
      {{/unless}}
    </div>
    {{#if this.isInviteMode}}
      {{#if this.doInvite.isRunning}}
        <LoadingIndicator />
      {{/if}}
      <div class='invite-form'>
        <FieldContainer @label='Invite:' @tag='label'>
          <BoxelInput
            data-test-room-invite-field
            type='text'
            @value={{this.membersToInviteFormatted}}
            @onInput={{this.setMembersToInvite}}
          />
        </FieldContainer>
        <div class='invite-button-wrapper'>
          <Button
            data-test-room-invite-cancel-btn
            {{on 'click' this.cancelInvite}}
          >Cancel</Button>
          <Button
            data-test-room-invite-btn
            @kind='primary'
            @disabled={{not this.membersToInvite}}
            {{on 'click' this.invite}}
          >Invite</Button>
        </div>
      </div>
    {{/if}}

    {{#if this.objective}}
      <div class='room__objective'> <this.objectiveComponent /> </div>
    {{/if}}

    <div
      class='messages-wrapper'
      data-test-room-settled={{this.doWhenRoomChanges.isIdle}}
      data-test-room-name={{this.room.name}}
    >
      <div class='messages'>
        <div class='notices'>
          <div data-test-timeline-start class='timeline-start'>
            - Beginning of conversation -
          </div>
        </div>
        {{#each this.messageCardComponents as |Message|}}
          {{#unless Message.card.command}}
            <Message.component />
          {{/unless}}
          {{#if (eq Message.card.command.commandType 'patch')}}
            <Button
              data-test-command-apply
              {{on
                'click'
                (fn
                  this.patchCard
                  Message.card.command.payload.id
                  Message.card.command.payload.patch.attributes
                )
              }}
              @loading={{this.operatorModeStateService.patchCard.isRunning}}
              @disabled={{this.operatorModeStateService.patchCard.isRunning}}
            >Apply</Button>
          {{/if}}
        {{else}}
          <div data-test-no-messages>
            (No messages)
          </div>
        {{/each}}
      </div>
    </div>

    <div class='send-message'>
      <BoxelInput
        data-test-message-field={{this.room.name}}
        type='text'
        @multiline={{true}}
        @value={{this.messageToSend}}
        @onInput={{this.setMessage}}
        rows='4'
        cols='20'
      />
      {{#if this.cardtoSend}}
        <Button data-test-remove-card-btn {{on 'click' this.removeCard}}>Remove
          Card</Button>
      {{else}}
        {{#if this.canSetObjective}}
          <Button
            data-test-set-objective-btn
            @disabled={{this.doSetObjective.isRunning}}
            {{on 'click' this.setObjective}}
          >Set Objective</Button>
        {{/if}}
        <Button
          data-test-choose-card-btn
          @disabled={{this.doChooseCard.isRunning}}
          {{on 'click' this.chooseCard}}
        >Choose Card</Button>
        <Button
          data-test-send-open-cards-btn
          @loading={{this.doSendMessage.isRunning}}
          @disabled={{this.doSendMessage.isRunning}}
          {{on 'click' this.sendOpenCards}}
        >Send open cards</Button>
      {{/if}}
      <Button
        data-test-send-message-btn
        @disabled={{and (not this.messageToSend) (not this.cardtoSend)}}
        @loading={{this.doSendMessage.isRunning}}
        @kind='primary'
        {{on 'click' this.sendMessage}}
      >Send</Button>
    </div>
    {{#if this.cardtoSend}}
      <div class='selected-card'>
        <div class='field'>Selected Card:</div>
        <div
          class='card-wrapper'
          data-test-selected-card={{this.cardtoSend.id}}
        >
          <this.cardToSendComponent />
        </div>
      </div>
    {{/if}}
    <style>
      .messages-wrapper {
        padding: var(--boxel-sp);
        margin: var(--boxel-sp) 0;
      }

      .timeline-start {
        padding-bottom: var(--boxel-sp);
      }

      .notices {
        display: flex;
        justify-content: center;
      }

      .messages .boundaries {
        margin: var(--boxel-sp-sm) 0;
      }

      .send-message {
        display: flex;
        justify-content: right;
        flex-wrap: wrap;
        row-gap: var(--boxel-sp-sm);
        margin: 0 var(--boxel-sp);
      }

      .send-message button,
      .send-message .selected-card {
        margin-left: var(--boxel-sp-sm);
      }

      .selected-card {
        margin: var(--boxel-sp);
        float: right;
      }

      .selected-card::after {
        content: '';
        clear: both;
      }

      .field {
        font-weight: bold;
      }

      .card-wrapper {
        padding: var(--boxel-sp);
        border: var(--boxel-border);
        border-radius: var(--boxel-border-radius);
      }

      .members {
        font-size: var(--boxel-font-size-sm);
        font-weight: initial;
      }

      .room-members {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        padding: var(--boxel-sp) var(--boxel-sp) 0;
      }

      .room__objective {
        padding: var(--boxel-sp);
      }

      .invite-form {
        padding: var(--boxel-sp);
      }

      .invite-form button {
        margin-left: var(--boxel-sp-xs);
      }

      .invite-button-wrapper {
        display: flex;
        justify-content: flex-end;
        padding-top: var(--boxel-sp-xs);
      }

      .invite-btn {
        margin-top: var(--boxel-sp-xs);
      }
    </style>
  </template>

  @service private declare matrixService: MatrixService;
  @service private declare cardService: CardService;
  @service private declare operatorModeStateService: OperatorModeStateService;
  @tracked private isInviteMode = false;
  @tracked private membersToInvite: string[] = [];
  @tracked private allowedToSetObjective: boolean | undefined;
  @tracked private subscribedRoom: FieldDef | undefined;
  private messagesToSend: TrackedMap<string, string | undefined> =
    new TrackedMap();
  private cardsToSend: TrackedMap<string, CardDef | undefined> =
    new TrackedMap();
  private roomResource = getRoom(this, () => this.args.roomId);

  constructor(owner: unknown, args: any) {
    super(owner, args);
    this.doMatrixEventFlush.perform();

    // We use a signal in DOM for playwright to be able to tell if the interior
    // card async has settled. This is akin to test-waiters in ember-test. (playwright
    // runs against the development environment of ember serve)
    if (environment === 'development') {
      registerDestructor(this, this.cleanup);
      this.subscribeToRoomChanges.perform();
    }
  }

  private get room() {
    return this.roomResource.room;
  }

  private get objective() {
    return this.matrixService.roomObjectives.get(this.args.roomId);
  }

  private patchCard = (cardId: string, attributes: any) => {
    this.operatorModeStateService.patchCard.perform(cardId, attributes);
  };

  private subscribeToRoomChanges = task(async () => {
    await this.cardService.ready;
    while (true) {
      if (this.room && this.subscribedRoom !== this.room) {
        if (this.subscribedRoom) {
          this.cardService.unsubscribe(this.subscribedRoom, this.onCardChange);
        }
        this.subscribedRoom = this.room;
        this.cardService.subscribe(this.subscribedRoom, this.onCardChange);
      }
      await timeout(50);
    }
  });

  private onCardChange = () => {
    this.doWhenRoomChanges.perform();
  };

  private doWhenRoomChanges = restartableTask(async () => {
    await all([this.cardService.cardsSettled(), timeout(500)]);
  });

  private cleanup = () => {
    if (this.subscribedRoom) {
      this.cardService.unsubscribe(this.subscribedRoom, this.onCardChange);
    }
  };

  @cached
  private get attachedCardIds() {
    if (!this.room) {
      return [];
    }
    return this.room.messages
      .filter((m) => m.attachedCardId)
      .map((m) => m.attachedCardId);
  }

  @cached
  private get totalCards() {
    if (!this.room) {
      return 0;
    }
    return this.attachedCardIds.length;
  }

  private get objectiveComponent() {
    if (this.objective) {
      return this.objective.constructor.getComponent(
        this.objective,
        'embedded',
      );
    }
    return;
  }

  private get messageCardComponents() {
    return this.room
      ? this.room.messages.map((messageCard) => {
          return {
            component: messageCard.constructor.getComponent(
              messageCard,
              'embedded',
            ),
            card: messageCard,
          };
        })
      : [];
  }

  @cached
  private get memberNames() {
    if (!this.room) {
      return;
    }
    return [
      ...this.room.joinedMembers.map((m) => m.displayName),
      ...this.room.invitedMembers.map((m) => `${m.displayName} (invited)`),
    ].join(', ');
  }

  private get messageToSend() {
    return this.messagesToSend.get(this.args.roomId);
  }

  private get cardtoSend() {
    return this.cardsToSend.get(this.args.roomId);
  }

  private get canSetObjective() {
    return !this.objective && this.allowedToSetObjective;
  }

  private get cardToSendComponent() {
    if (this.cardtoSend) {
      return this.cardtoSend.constructor.getComponent(
        this.cardtoSend,
        'embedded',
      );
    }
    return;
  }

  private get membersToInviteFormatted() {
    return this.membersToInvite.join(', ');
  }

  @action
  private setMessage(message: string) {
    this.messagesToSend.set(this.args.roomId, message);
  }

  @action
  private sendMessage() {
    if (this.messageToSend == null && !this.cardtoSend) {
      throw new Error(
        `bug: should never get here, send button is disabled when there is no message nor card`,
      );
    }
    this.doSendMessage.perform(this.messageToSend, this.cardtoSend);
  }

  @action
  private sendOpenCards() {
    for (let stackItem of this.operatorModeStateService.topMostStackItems()) {
      this.doSendMessage.perform(undefined, stackItem.card);
    }
  }

  @action
  private showInviteMode() {
    this.isInviteMode = true;
  }

  @action
  private setMembersToInvite(invite: string) {
    this.membersToInvite = invite.split(',').map((i) => i.trim());
  }

  @action
  private cancelInvite() {
    this.resetInvite();
  }

  @action
  private invite() {
    this.doInvite.perform();
  }

  @action
  private chooseCard() {
    this.doChooseCard.perform();
  }

  @action
  private setObjective() {
    this.doSetObjective.perform();
  }

  @action
  private removeCard() {
    this.cardsToSend.set(this.args.roomId, undefined);
  }

  private doSendMessage = restartableTask(
    async (message: string | undefined, card?: CardDef) => {
      this.messagesToSend.set(this.args.roomId, undefined);
      this.cardsToSend.set(this.args.roomId, undefined);
      await this.matrixService.sendMessage(this.args.roomId, message, card);
    },
  );

  private doInvite = restartableTask(async () => {
    await this.matrixService.invite(this.args.roomId, this.membersToInvite);
    this.resetInvite();
  });

  private doMatrixEventFlush = restartableTask(async () => {
    await this.matrixService.flushMembership;
    await this.matrixService.flushTimeline;
    await this.roomResource.loading;
    this.allowedToSetObjective = await this.matrixService.allowedToSetObjective(
      this.args.roomId,
    );
  });

  private doChooseCard = restartableTask(async () => {
    let chosenCard: CardDef | undefined = await chooseCard({
      filter: { type: baseCardRef },
    });
    if (chosenCard) {
      this.cardsToSend.set(this.args.roomId, chosenCard);
    }
  });

  private doSetObjective = restartableTask(async () => {
    let catalogEntry = await chooseCard<CatalogEntry>({
      filter: {
        on: catalogEntryRef,
        eq: { isPrimitive: false },
      },
    });
    if (catalogEntry) {
      await this.matrixService.setObjective(this.args.roomId, catalogEntry.ref);
    }
  });

  private resetInvite() {
    this.membersToInvite = [];
    this.isInviteMode = false;
  }
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Room {
    'Matrix::Room': typeof Room;
  }
}
