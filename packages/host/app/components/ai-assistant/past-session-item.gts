import { fn, array } from '@ember/helper';
import { on } from '@ember/modifier';
import { service } from '@ember/service';
import Component from '@glimmer/component';

import { format as formatDate, isSameDay, isSameYear } from 'date-fns';

import {
  BoxelDropdown,
  IconButton,
  Menu,
  Tooltip,
} from '@cardstack/boxel-ui/components';
import { menuItem } from '@cardstack/boxel-ui/helpers';
import {
  Upload,
  IconPencil,
  IconTrash,
  ThreeDotsHorizontal,
} from '@cardstack/boxel-ui/icons';

import type MatrixService from '@cardstack/host/services/matrix-service';

import type { RoomField } from 'https://cardstack.com/base/room';

export type RoomActions = {
  open: (roomId: string) => void;
  rename: (room: RoomField) => void;
  delete: (room: RoomField) => void;
};

interface Signature {
  Args: {
    room: RoomField;
    actions: RoomActions;
  };
}

export default class PastSessionItem extends Component<Signature> {
  get roomId() {
    return this.args.room.roomId.value as string;
  }
  <template>
    <li class='session' data-test-joined-room={{this.roomId}}>
      <button
        class='view-session-button'
        {{on 'click' (fn @actions.open this.roomId)}}
        data-test-enter-room={{this.roomId}}
      >
        <div class='name'>{{@room.name.value}}</div>
        <div class='date' data-test-last-active={{this.lastActive}}>
          {{this.formattedDate}}
        </div>
      </button>
      <BoxelDropdown>
        <:trigger as |bindings|>
          <Tooltip @placement='top'>
            <:trigger>
              <IconButton
                @icon={{ThreeDotsHorizontal}}
                @width='20px'
                @height='20px'
                class='menu-button'
                aria-label='Options'
                data-test-past-session-options-button={{this.roomId}}
                {{bindings}}
              />
            </:trigger>
            <:content>
              More Options
            </:content>
          </Tooltip>
        </:trigger>
        <:content as |dd|>
          <Menu
            class='menu past-session-menu'
            @closeMenu={{dd.close}}
            @items={{array
              (menuItem
                'Open Session' (fn @actions.open this.roomId) icon=Upload
              )
              (menuItem 'Rename' (fn @actions.rename @room) icon=IconPencil)
              (menuItem 'Delete' (fn @actions.delete @room) icon=IconTrash)
            }}
          />
        </:content>
      </BoxelDropdown>
    </li>

    <style>
      .session {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-top: 1px solid var(--boxel-300);
        padding-top: var(--boxel-sp-sm);
        padding-left: var(--boxel-sp-xs);
        padding-bottom: var(--boxel-sp-sm);
        margin-right: var(--boxel-sp-xs);
        margin-left: var(--boxel-sp-xs);
      }
      .session:hover {
        background-color: var(--boxel-200);
        cursor: pointer;
        border-radius: 8px;
      }
      .session:hover + .session {
        border-top-color: transparent;
      }
      .name {
        font-weight: 600;
      }
      .date {
        margin-top: var(--boxel-sp-4xs);
        color: var(--boxel-450);
      }
      .view-session-button {
        background-color: transparent;
        border: none;
        width: 100%;
        text-align: left;
      }
      .menu-button:hover:not(:disabled) {
        --icon-color: var(--boxel-highlight);
      }
      .menu :deep(svg) {
        --icon-stroke-width: 1.5px;
      }
      .menu :deep(.boxel-menu__item:nth-child(2) svg) {
        --icon-stroke-width: 0.5px;
      }
    </style>
  </template>

  @service declare matrixService: MatrixService;

  get createDate() {
    if (!this.args.room.created) {
      // there is a race condition in the matrix SDK where newly created
      // rooms don't immediately have a created date
      return new Date();
    }
    return this.args.room.created;
  }

  private get lastActive() {
    return (
      this.matrixService.getLastActiveTimestamp(this.args.room) ??
      this.createDate.getTime()
    );
  }

  private get formattedDate() {
    let now = new Date();
    if (isSameDay(this.lastActive, now)) {
      return `Today ${formatDate(this.lastActive, 'MMM d, h:mm aa')}`;
    } else if (isSameYear(this.lastActive, now)) {
      return formatDate(this.lastActive, 'iiii MMM d, h:mm aa');
    }
    return formatDate(this.lastActive, 'iiii MMM d, yyyy, h:mm aa');
  }
}
