import { fn } from '@ember/helper';
import { on } from '@ember/modifier';

import Component from '@glimmer/component';

import { BoxelButton, Modal } from '@cardstack/boxel-ui/components';
import { cssVar } from '@cardstack/boxel-ui/helpers';

import type CardDef from 'https://cardstack.com/base/card-def';

interface Signature {
  Args: {
    itemToDelete: CardDef | URL | string | null | undefined;
    onConfirm: (item: CardDef | URL | string) => void;
    onCancel: () => void;
    isDeleteRunning?: boolean;
    itemInfo?: {
      type: string;
      name: string;
      id: string;
    };
    error?: string;
  };
}

export default class DeleteModal extends Component<Signature> {
  <template>
    <Modal
      data-test-delete-modal-container
      data-test-delete-modal={{this.itemInfo.id}}
      @layer='urgent'
      @size='x-small'
      @isOpen={{true}}
      @onClose={{@onCancel}}
      style={{cssVar boxel-modal-offset-top='40vh'}}
    >
      <section class='delete'>
        <p class='content' data-test-delete-msg>
          Delete the
          {{this.itemInfo.type}}<br />
          <strong>{{this.itemInfo.name}}</strong>?
        </p>
        <p class='content disclaimer'>This action is not reversible.</p>
        <footer class='buttons'>
          {{#if @isDeleteRunning}}
            <BoxelButton @size='tall' @kind='danger' @loading={{true}}>
              Deleting
            </BoxelButton>
          {{else}}
            <BoxelButton
              data-test-confirm-cancel-button
              @size='tall'
              @kind='secondary-light'
              {{on 'click' @onCancel}}
            >
              Cancel
            </BoxelButton>
            <BoxelButton
              data-test-confirm-delete-button
              @size='tall'
              @kind='danger'
              {{on 'click' (fn @onConfirm this.item)}}
            >
              Delete
            </BoxelButton>
          {{/if}}
          {{#if @error}}
            <p class='error'>{{@error}}</p>
          {{/if}}
        </footer>
      </section>
    </Modal>

    <style>
      .content {
        width: 100%;
        margin: 0;
        font: 500 var(--boxel-font);
        letter-spacing: var(--boxel-lsp-xs);
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .content + .content {
        margin-top: var(--boxel-sp-xs);
      }
      .disclaimer {
        color: var(--boxel-danger);
        font: 500 var(--boxel-font-xs);
        letter-spacing: var(--boxel-lsp-xs);
      }
      .delete {
        padding: var(--boxel-sp-lg) var(--boxel-sp-lg) var(--boxel-sp);
        background-color: var(--boxel-light);
        border-radius: var(--boxel-border-radius-xl);
        box-shadow: var(--boxel-deep-box-shadow);
      }
      .buttons {
        margin-top: var(--boxel-sp-lg);
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        width: 100%;
      }
      button:first-child {
        margin-right: var(--boxel-sp-xs);
      }
      .error {
        flex-grow: 1;
        color: var(--boxel-danger);
        font: 500 var(--boxel-font-sm);
        letter-spacing: var(--boxel-lsp-xs);
        margin-top: var(--boxel-sp);
        margin-bottom: 0;
      }
    </style>
  </template>

  private get item() {
    if (!this.args.itemToDelete) {
      throw new Error('DeleteModal requires an itemToDelete');
    }
    return this.args.itemToDelete;
  }

  private get itemInfo() {
    if (typeof this.item === 'string' && !this.args.itemInfo) {
      throw new Error('DeleteModal requires itemInfo');
    }

    if (this.args.itemInfo || typeof this.item === 'string') {
      return this.args.itemInfo;
    }

    if (this.item instanceof URL) {
      return {
        type: 'file',
        name: decodeURI(this.item.href).split('/').pop()!,
        id: this.item.href,
      };
    }

    return {
      type: 'card',
      name: this.item.title,
      id: this.item.id,
    };
  }
}
