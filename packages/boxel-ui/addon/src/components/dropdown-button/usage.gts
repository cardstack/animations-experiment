import type { Icon } from '@cardstack/boxel-ui/icons/types';
import { array, fn } from '@ember/helper';
import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';

import menuDivider from '../..//helpers/menu-divider.ts';
import menuItem from '../../helpers/menu-item.ts';
import ThreeDotsHorizontal from '../../icons/three-dots-horizontal.gts';
import BoxelDropdownButton from './index.gts';

export default class DropdownButtonUsageComponent extends Component {
  @tracked label = 'Label';
  @tracked icon: Icon = ThreeDotsHorizontal;
  @tracked size = 30;
  @tracked iconSize = 16;

  @action log(message: string): void {
    // eslint-disable-next-line no-console
    console.log(message);
  }

  <template>
    <FreestyleUsage @name='DropdownButton'>
      <:example>
        <BoxelDropdownButton
          @label={{this.label}}
          @icon={{this.icon}}
          @size={{this.size}}
          @iconSize={{this.iconSize}}
          as |ddb|
        >
          <ddb.Menu
            @items={{array
              (menuItem 'Duplicate' (fn this.log 'Duplicate menu item clicked'))
              (menuItem 'Share' (fn this.log 'Share menu item clicked'))
              (menuDivider)
              (menuItem
                'Remove' (fn this.log 'Remove menu item clicked') dangerous=true
              )
            }}
          />
        </BoxelDropdownButton>
      </:example>
      <:api as |Args|>
        <Args.String
          @name='button'
          @description='the name to use as the aria-label and added on the trigger element as a css class. If @icon is not specified, this value is also used to specify an svg to use.'
          @value={{this.label}}
          @required={{true}}
          @onInput={{fn (mut this.label)}}
        />
        <Args.String
          @name='icon'
          @description='the name of the svg to show'
          @value={{this.icon}}
          @required={{true}}
          @onInput={{fn (mut this.icon)}}
        />
        <Args.Number
          @name='size'
          @description='the size of the button'
          @value={{this.size}}
          @defaultValue={{30}}
          @min={{20}}
          @max={{80}}
          @onInput={{fn (mut this.size)}}
        />
        <Args.Number
          @name='iconSize'
          @description='the size of the icon'
          @value={{this.iconSize}}
          @defaultValue={{16}}
          @min={{8}}
          @max={{36}}
          @onInput={{fn (mut this.iconSize)}}
        />
        <Args.Yield
          @description="The provided block is rendered when the button is triggered. Yields a 'Menu' component (instance of Boxel::Menu that is preconfigured with @closeMenu defined) and the 'dropdown' object documented in Boxel::Dropdown"
        />
      </:api>
    </FreestyleUsage>
  </template>
}
