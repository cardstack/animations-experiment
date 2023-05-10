import {
  contains,
  linksTo,
  field,
  Card,
  Component,
} from 'https://cardstack.com/base/card-api';
import IntegerCard from 'https://cardstack.com/base/integer';
import StringCard from 'https://cardstack.com/base/string';

export class Friend extends Card {
  static displayName = 'Friend';
  @field firstName = contains(StringCard);
  @field friend = linksTo(() => Friend);
  @field test = contains(IntegerCard, {
    computeVia: function () {
      // make sure we don't blow up when '/' appears
      return 10 / 2;
    },
  });
  @field title = contains(StringCard, {
    computeVia: function (this: Friend) {
      return this.firstName;
    },
  });
  static embedded = class Embedded extends Component<typeof this> {
    <template>
      <@fields.firstName />
    </template>
  };
}
