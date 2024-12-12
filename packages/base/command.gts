import {
  CardDef,
  Component,
  FieldDef,
  StringField,
  contains,
  field,
  linksTo,
  linksToMany,
  primitive,
  queryableValue,
} from './card-api';
import CodeRefField from './code-ref';
import BooleanField from './boolean';
import { SkillCard } from './skill-card';

export type CommandStatus = 'applied' | 'ready' | 'applying';

class CommandObjectFieldTemplate extends Component<typeof CommandObjectField> {
  <template>
    <pre>{{this.stringValue}}</pre>
    <style scoped>
      pre {
        margin: 0;
        white-space: pre-wrap;
      }
    </style>
  </template>

  get stringValue() {
    return JSON.stringify(this.args.model, null, 2);
  }
}

export class CommandObjectField extends FieldDef {
  static [primitive]: Record<string, any>;
  static [queryableValue](value: Record<string, any> | undefined) {
    return Boolean(value) && typeof value === 'object'
      ? JSON.stringify(value)
      : undefined;
  }
  static edit = CommandObjectFieldTemplate;
  static embedded = CommandObjectFieldTemplate;
}

export class SaveCardInput extends CardDef {
  @field realm = contains(StringField);
  @field card = linksTo(CardDef);
}

class JsonField extends FieldDef {
  static [primitive]: Record<string, any>;
}

export class PatchCardInput extends CardDef {
  @field cardId = contains(StringField);
  @field patch = contains(JsonField);
}

export class ShowCardInput extends CardDef {
  @field cardToShow = linksTo(CardDef);
}

export class SwitchSubmodeInput extends CardDef {
  @field submode = contains(StringField);
  @field codePath = contains(StringField);
}

export class WriteTextFileInput extends CardDef {
  @field content = contains(StringField);
  @field realm = contains(StringField);
  @field path = contains(StringField);
  @field overwrite = contains(BooleanField);
}

export class CreateInstanceInput extends CardDef {
  @field module = contains(CodeRefField);
  @field realm = contains(StringField);
}

export class CreateAIAssistantRoomInput extends CardDef {
  @field name = contains(StringField);
}

export class CreateAIAssistantRoomResult extends CardDef {
  @field roomId = contains(StringField);
}

export class AddSkillsToRoomInput extends CardDef {
  @field roomId = contains(StringField);
  @field skills = linksToMany(SkillCard);
}
