import { CardDef } from 'https://cardstack.com/base/card-api';
import { Component } from 'https://cardstack.com/base/card-api';
import StoreIcon from '@cardstack/boxel-icons/store';

export class Seller extends CardDef {
  static displayName = 'Seller';
  static icon = StoreIcon;

  static embedded = class Embedded extends Component<typeof this> {
    <template>
      <@fields.title />
    </template>
  };

  /*
  static isolated = class Isolated extends Component<typeof this> {
    <template></template>
  }

  static atom = class Atom extends Component<typeof this> {
    <template></template>
  }

  static edit = class Edit extends Component<typeof this> {
    <template></template>
  }
  */
}
