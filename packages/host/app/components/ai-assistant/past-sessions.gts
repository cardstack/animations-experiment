import { on } from '@ember/modifier';
import Component from '@glimmer/component';

import { IconButton } from '@cardstack/boxel-ui/components';
import { eq } from '@cardstack/boxel-ui/helpers';
import { DropdownArrowFilled } from '@cardstack/boxel-ui/icons';

import AiAssistantPanelPopover from './panel-popover';
import PastSessionItem, { type RoomActions } from './past-session-item';

import type { AiSessionRoom } from './panel';

interface Signature {
  Args: {
    sessions: AiSessionRoom[];
    roomActions: RoomActions;
    onClose: () => void;
  };
  Element: HTMLElement;
}

export default class AiAssistantPastSessionsList extends Component<Signature> {
  <template>
    <AiAssistantPanelPopover data-test-past-sessions ...attributes>
      <:header>
        Past Sessions
        <IconButton
          @icon={{DropdownArrowFilled}}
          @width='12px'
          @height='12px'
          {{on 'click' @onClose}}
          aria-label='Close Past Sessions'
          data-test-close-past-sessions
        />
      </:header>
      <:body>
        {{#if (eq @sessions.length 0)}}
          <div class='empty-collection'>
            No past sessions to show.
          </div>
        {{else}}
          <ul class='past-sessions'>
            {{#each @sessions as |session|}}
              <PastSessionItem
                @room={{session.room}}
                @joinDate={{session.member.membershipDateTime}}
                @actions={{@roomActions}}
              />
            {{/each}}
          </ul>
        {{/if}}
      </:body>
    </AiAssistantPanelPopover>

    <style>
      .past-sessions {
        list-style-type: none;
        padding: 0;
        margin: 0;
        margin-bottom: var(--boxel-sp-xs);
      }
      .empty-collection {
        padding: var(--boxel-sp-sm);
        text-align: center;
        color: var(--boxel-450);
      }
    </style>
  </template>
}
