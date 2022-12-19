import Component from '@glimmer/component';
import type { CardRef } from '@cardstack/runtime-common';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { registerDestructor } from '@ember/destroyable';
import { Deferred } from '@cardstack/runtime-common/deferred';
import { taskFor } from 'ember-concurrency-ts';
import { enqueueTask } from 'ember-concurrency'
import { service } from '@ember/service';
import type CardService from '../services/card-service';
import type { Card } from 'https://cardstack.com/base/card-api';
import CardEditor from './card-editor';
import { Modal, CardContainer, Header } from '@cardstack/boxel-ui';
import { initStyleSheet, attachStyles } from '@cardstack/boxel-ui/attach-styles';

let modalStyles = initStyleSheet(`
  .dialog-box {
    height: 100%;
    display: grid;
    grid-template-rows: auto 1fr;
  }
  .dialog-box__content {
    padding: var(--boxel-sp);
    height: 100%;
    overflow: auto;
  }
  .dialog-box__content > * + * {
    margin-top: 1em;
  }
`);

export default class CreateCardModal extends Component {
  <template>
    {{#let this.currentRequest.card as |card|}}
      {{#if card}}
        <Modal
          @size="large"
          @isOpen={{true}}
          @onClose={{fn this.save undefined}}
          open
          {{attachStyles modalStyles}}
          data-test-create-new-card={{card.constructor.name}}
        >
          <CardContainer class="dialog-box" @displayBoundaries={{true}}>
            <Header @label="Create New Card" @large={{true}}>
              <button {{on "click" (fn this.save undefined)}} type="button">X Close</button>
            </Header>
            <section class="dialog-box__content">
              <CardEditor
                @card={{card}}
                @onSave={{this.save}}
              />
            </section>
          </CardContainer>
        </Modal>
      {{/if}}
    {{/let}}
  </template>

  @service declare cardService: CardService;
  @tracked currentRequest: {
    card: Card;
    deferred: Deferred<Card | undefined>;
  } | undefined = undefined;

  constructor(owner: unknown, args: {}) {
    super(owner, args);
    (globalThis as any)._CARDSTACK_CREATE_NEW_CARD = this;
    registerDestructor(this, () => {
      delete (globalThis as any)._CARDSTACK_CREATE_NEW_CARD;
    });
  }

  async create<T extends Card>(ref: CardRef): Promise<undefined | T> {
    return await taskFor(this._create).perform(ref) as T | undefined;
  }

  @enqueueTask private async _create<T extends Card>(ref: CardRef): Promise<undefined | T> {
    let doc = { data: { meta: { adoptsFrom: ref }}};
    this.currentRequest = {
      card: await this.cardService.createFromSerialized(doc.data, doc),
      deferred: new Deferred(),
    };
    let card = await this.currentRequest.deferred.promise;
    if (card) {
      return card as T;
    } else {
      return undefined;
    }
  }

  @action save(card?: Card): void {
    if (this.currentRequest) {
      this.currentRequest.deferred.resolve(card);
      this.currentRequest = undefined;
    }
  }
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    CreateCardModal: typeof CreateCardModal;
   }
}
