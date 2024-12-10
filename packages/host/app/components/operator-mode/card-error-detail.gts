import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { service } from '@ember/service';

import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import TriangleAlert from '@cardstack/boxel-icons/triangle-alert';

import { dropTask } from 'ember-concurrency';
import perform from 'ember-concurrency/helpers/perform';

import { Accordion, Button } from '@cardstack/boxel-ui/components';

import SwitchSubmodeCommand from '../../commands/switch-submode';
import { type CardError } from '../../resources/card-resource';

import type CommandService from '../../services/command-service';

interface Signature {
  Args: {
    error: CardError['errors'][0];
    viewInCodeMode?: true;
    title?: string;
  };
}

export default class CardErrorDetail extends Component<Signature> {
  @tracked private showErrorDetail = false;
  @service private declare commandService: CommandService;

  private toggleDetail = () => (this.showErrorDetail = !this.showErrorDetail);

  private viewInCodeMode = dropTask(async () => {
    let switchSubmodeCommand = new SwitchSubmodeCommand(
      this.commandService.commandContext,
    );
    const InputType = await switchSubmodeCommand.getInputType();
    let input = new InputType({
      submode: 'code',
      codePath: `${this.args.error.id}.json`,
    });
    await switchSubmodeCommand.execute(input);
  });

  <template>
    <Accordion class='error-detail' as |A|>
      <A.Item
        data-test-error-detail-toggle
        @onClick={{fn this.toggleDetail 'schema'}}
        @isOpen={{this.showErrorDetail}}
      >
        <:title>
          <TriangleAlert />
          An error was encountered on this card:
          <span data-test-error-title>{{@title}}</span>
        </:title>
        <:content>
          {{#if @viewInCodeMode}}
            <div class='actions'>
              <Button
                data-test-view-in-code-mode-button
                @kind='primary'
                {{on 'click' (perform this.viewInCodeMode)}}
              >View in Code Mode</Button>
            </div>
          {{/if}}
          <div class='detail'>
            <div class='detail-item'>
              <div class='detail-title'>Details:</div>
              <div
                class='detail-contents'
                data-test-error-detail
              >{{@error.message}}</div>
            </div>
            {{#if @error.meta.stack}}
              <div class='detail-item'>
                <div class='detail-title'>Stack trace:</div>
                <pre
                  data-test-error-stack
                  data-test-percy-hide
                >
{{@error.meta.stack}}
                </pre>
              </div>
            {{/if}}
          </div>
        </:content>
      </A.Item>
    </Accordion>

    <style scoped>
      .error-detail {
        flex: 1;
      }
      .actions {
        display: flex;
        justify-content: center;
        margin-top: var(--boxel-sp-lg);
      }
      .detail {
        padding: var(--boxel-sp);
      }
      .detail-item {
        margin-top: var(--boxel-sp);
      }
      .detail-title {
        font: 600 var(--boxel-font);
      }
      .detail-contents {
        font: var(--boxel-font);
      }
      pre {
        margin-top: 0;
        white-space: pre-wrap;
        word-break: break-all;
      }
    </style>
  </template>
}
