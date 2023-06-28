import Component from '@glimmer/component';
import { service } from '@ember/service';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
//@ts-expect-error the types don't recognize the cached export
import { tracked, cached } from '@glimmer/tracking';
import { not, and } from '@cardstack/host/helpers/truth-helpers';
import { restartableTask } from 'ember-concurrency';
import {
  BoxelHeader,
  BoxelInput,
  LoadingIndicator,
  FieldContainer,
  Button,
} from '@cardstack/boxel-ui';
import { getRoomCard } from '@cardstack/host/resources/room-card';
import { TrackedMap } from 'tracked-built-ins';
import {
  chooseCard,
  baseCardRef,
  catalogEntryRef,
} from '@cardstack/runtime-common';
import type MatrixService from '@cardstack/host/services/matrix-service';
import { type Card } from 'https://cardstack.com/base/card-api';
import type CardService from '@cardstack/host/services/card-service';
import { type CatalogEntry } from 'https://cardstack.com/base/catalog-entry';

const TRUE = true;

interface RoomArgs {
  Args: {
    roomId: string;
  };
}
export default class Room extends Component<RoomArgs> {
  <template>
    <BoxelHeader
      @title={{this.roomCard.name}}
      @hasBackground={{TRUE}}
      class='matrix header'
      data-test-matrix-room-header
    >
      <:actions>
        <Button
          data-test-invite-mode-btn
          class='invite-btn'
          {{on 'click' this.showInviteMode}}
          @disabled={{this.isInviteMode}}
        >Invite</Button>
        <div data-test-room-members class='members'><b>Members:</b>
          {{this.memberNames}}</div>
      </:actions>
    </BoxelHeader>
    {{#if this.isInviteMode}}
      {{#if this.doInvite.isRunning}}
        <LoadingIndicator />
      {{/if}}
      <fieldset>
        <FieldContainer @label='Invite:' @tag='label'>
          <BoxelInput
            data-test-room-invite-field
            type='text'
            @value={{this.membersToInviteFormatted}}
            @onInput={{this.setMembersToInvite}}
          />
        </FieldContainer>
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
      </fieldset>
    {{/if}}

    {{#if this.objective}}
      <div class='room__objective'> <this.objectiveComponent /> </div>
    {{/if}}

    <div class='messages-wrapper'>
      <div class='messages'>
        <div class='notices'>
          <div data-test-timeline-start class='timeline-start'>
            - Beginning of conversation -
          </div>
        </div>
        {{#each this.messageCardComponents as |Message|}}
          <Message />
        {{else}}
          <div data-test-no-messages>
            (No messages)
          </div>
        {{/each}}
      </div>
    </div>

    <div class='send-message'>
      <BoxelInput
        data-test-message-field
        type='text'
        @multiline={{TRUE}}
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
      .header .boxel-header__content {
        display: block;
      }

      .invite-btn {
        display: block;
        float: right;
        margin-bottom: var(--boxel-sp-sm);
      }

      .messages-wrapper {
        overflow-y: auto;
        max-height: 30vh;
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
        content:'';
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
        clear: both;
        font-size: var(--boxel-font-size-sm);
        font-weight: initial;
      }

      header.matrix .content {
        position: relative;
        display: block;
      }
    </style>
  </template>

  @service private declare matrixService: MatrixService;
  @service private declare cardService: CardService;
  @tracked private isInviteMode = false;
  @tracked private membersToInvite: string[] = [];
  private messagesToSend: TrackedMap<string, string | undefined> =
    new TrackedMap();
  private cardsToSend: TrackedMap<string, Card | undefined> = new TrackedMap();
  private roomCardResource = getRoomCard(this, () => this.args.roomId);

  constructor(owner: unknown, args: any) {
    super(owner, args);
    this.doMatrixEventFlush.perform();
  }

  private get roomCard() {
    return this.roomCardResource.roomCard;
  }

  private get objective() {
    return this.matrixService.roomObjectives.get(this.args.roomId);
  }

  private get objectiveComponent() {
    if (this.objective) {
      return this.objective.constructor.getComponent(
        this.objective,
        'embedded'
      );
    }
    return;
  }

  private get messageCardComponents() {
    return this.roomCard
      ? this.roomCard.messages.map((messageCard) =>
          messageCard.constructor.getComponent(messageCard, 'embedded')
        )
      : [];
  }

  @cached
  private get memberNames() {
    if (!this.roomCard) {
      return;
    }
    return [
      ...this.roomCard.joinedMembers.map((m) => m.displayName),
      ...this.roomCard.invitedMembers.map((m) => `${m.displayName} (invited)`),
    ].join(', ');
  }

  private get messageToSend() {
    return this.messagesToSend.get(this.args.roomId);
  }

  private get cardtoSend() {
    return this.cardsToSend.get(this.args.roomId);
  }

  private get canSetObjective() {
    return (
      !this.objective && this.matrixService.canSetObjective(this.args.roomId)
    );
  }

  private get cardToSendComponent() {
    if (this.cardtoSend) {
      return this.cardtoSend.constructor.getComponent(
        this.cardtoSend,
        'embedded'
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
        `bug: should never get here, send button is disabled when there is no message nor card`
      );
    }
    this.doSendMessage.perform(this.messageToSend, this.cardtoSend);
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
    async (message: string | undefined, card?: Card) => {
      this.messagesToSend.set(this.args.roomId, undefined);
      this.cardsToSend.set(this.args.roomId, undefined);
      await this.matrixService.sendMessage(this.args.roomId, message, card);
    }
  );

  private doInvite = restartableTask(async () => {
    await this.matrixService.invite(this.args.roomId, this.membersToInvite);
    this.resetInvite();
  });

  private doMatrixEventFlush = restartableTask(async () => {
    await this.matrixService.flushMembership;
    await this.matrixService.flushTimeline;
    await this.roomCardResource.loading;
  });

  private doChooseCard = restartableTask(async () => {
    let chosenCard: Card | undefined = await chooseCard({
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
