import {
  contains,
  field,
  Component,
} from 'https://cardstack.com/base/card-api';
import CardDef from 'https://cardstack.com/base/card-def';
import DatetimeCard from 'https://cardstack.com/base/datetime';
import FieldDef from 'https://cardstack.com/base/field-def';
import NumberCard from 'https://cardstack.com/base/number';
import StringCard from 'https://cardstack.com/base/string';

import { PersonField } from './person';

export class Post extends CardDef {
  @field title = contains(StringCard);
  @field description = contains(StringCard);
  @field author = contains(PersonField);
  @field views = contains(NumberCard);
  @field createdAt = contains(DatetimeCard);
  static isolated = class Isolated extends Component<typeof this> {
    <template>
      <h1><@fields.title />
        by
        <@fields.author.firstName />
        (<@fields.author.fullName />)</h1>
    </template>
  };
}

export class PostField extends FieldDef {
  @field title = contains(StringCard);
  @field description = contains(StringCard);
  @field author = contains(PersonField);
  @field views = contains(NumberCard);
  @field createdAt = contains(DatetimeCard);
  static isolated = class Isolated extends Component<typeof this> {
    <template>
      <h1><@fields.title />
        by
        <@fields.author.firstName />
        (<@fields.author.fullName />)</h1>
    </template>
  };
}
