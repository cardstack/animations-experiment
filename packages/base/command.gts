import {
  CardDef,
  FieldDef,
  StringField,
  contains,
  field,
  primitive,
} from './card-api';
import { CommandResult } from './command-result';

type JSONValue = string | number | boolean | null | JSONObject | [JSONValue];

type JSONObject = { [x: string]: JSONValue };

type CommandObject = JSONObject;

class CommandObjectField extends FieldDef {
  static [primitive]: CommandObject;
}

export type CommandStatus = 'applied' | 'ready';

class CommandStatusField extends FieldDef {
  static [primitive]: CommandStatus;
}

export class CommandField extends CardDef {
  @field toolCallId = contains(StringField);
  @field name = contains(StringField);
  @field payload = contains(CommandObjectField); //arguments of toolCall. Its not called arguments due to lint
  @field eventId = contains(StringField);
  @field status = contains(CommandStatusField);
  @field result = contains(CommandResult);
}
