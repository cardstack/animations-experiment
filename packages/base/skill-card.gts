// import BooleanField from 'boolean';
import {
  CardDef,
  Component,
  field,
  // FieldDef,
  contains,
  // linksTo,
} from './card-api';
import TextAreaField from './text-area';

// export class SkillField extends FieldDef {
//   @field isActive = contains(BooleanField);
//   @field card = linksTo(SkillCard);
// }

export class SkillCard extends CardDef {
  static displayName = 'Skill Card';
  @field instructions = contains(TextAreaField);
  static embedded = class Embedded extends Component<typeof this> {
    <template>
      <@fields.title />
    </template>
  };
}
