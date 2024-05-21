import { field, contains } from 'https://cardstack.com/base/card-api';
import CardDef from 'https://cardstack.com/base/card-def';
import StringField from 'https://cardstack.com/base/string';

export class BigCard extends CardDef {
  static displayName = 'Big Card';
  @field name = contains(StringField);
  @field picture = contains(StringField);
  @field title = contains(StringField, {
    computeVia: function (this: BigCard) {
      return this.name;
    },
  });
}
