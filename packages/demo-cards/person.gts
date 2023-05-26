import {
  contains,
  linksTo,
  field,
  Component,
  Card,
} from 'https://cardstack.com/base/card-api';
import BooleanCard from 'https://cardstack.com/base/boolean';
import StringCard from 'https://cardstack.com/base/string';
import { CardContainer } from '@cardstack/boxel-ui';
import { Pet } from './pet';

export class Person extends Card {
  static displayName = 'Person';
  @field firstName = contains(StringCard);
  @field lastName = contains(StringCard);
  @field isCool = contains(BooleanCard);
  @field isHuman = contains(BooleanCard);
  @field pet = linksTo(() => Pet);
  @field title = contains(StringCard, {
    computeVia: function (this: Person) {
      return [this.firstName, this.lastName].filter(Boolean).join(' ');
    },
  });

  static embedded = class Embedded extends Component<typeof this> {
    <template>
      <CardContainer class='demo-card' @displayBoundaries={{true}}>
        <h3><@fields.firstName /> <@fields.lastName /></h3>
        {{#if @model.pet}}<div><@fields.pet /></div>{{/if}}
      </CardContainer>
    </template>
  };

  static isolated = class Isolated extends Component<typeof Person> {
    <template>
      <CardContainer class='demo-card' @displayBoundaries={{true}}>
        <h2><@fields.firstName /> <@fields.lastName /></h2>
        <div>
          <div>Is Cool: <@fields.isCool /></div>
          <div>Is Human: <@fields.isHuman /></div>
        </div>
        {{#if @model.pet}}<@fields.pet />{{/if}}
      </CardContainer>
    </template>
  };
}
