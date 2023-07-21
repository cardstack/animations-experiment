import {
  contains,
  field,
  linksTo,
  Component,
  Card,
} from 'https://cardstack.com/base/card-api';
import StringCard from 'https://cardstack.com/base/string';
import TextAreaCard from 'https://cardstack.com/base/text-area';
import { Person } from './person';

let imageURL = new URL('./logo.png', import.meta.url).href;

class BasicCard extends Card {
  @field title = contains(StringCard);
  static embedded = class Embedded extends Component<typeof this> {
    <template>
      Title: <@fields.title />
    </template>
  };
}

class VeryBasicCard extends BasicCard {
  @field description = contains(StringCard);
  static embedded = class Embedded extends Component<typeof this> {
    <template>
      Title:
      <@fields.title />
      Description:
      <@fields.description />
    </template>
  };
}

export class Post extends Card {
  static displayName = 'Post';
  @field author = contains(Person);
  @field title = contains(StringCard);
  @field body = contains(TextAreaCard);
  @field titleRef = contains(VeryBasicCard);
  @field titleLink = linksTo(VeryBasicCard);
  static isolated = class Isolated extends Component<typeof this> {
    <template>
      <h1><@fields.title /><img src='{{imageURL}}' /></h1>
      <h3>by <@fields.author.firstName /> <@fields.author.lastName /></h3>
      <p><@fields.body /></p>
    </template>
  };
  static embedded = class Embedded extends Component<typeof this> {
    <template>
      <em><@fields.title /></em>
      by
      <@fields.author.firstName />
      <@fields.author.lastName />
    </template>
  };
}
