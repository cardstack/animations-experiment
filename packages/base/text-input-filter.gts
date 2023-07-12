import { tracked } from '@glimmer/tracking';

export type DeserializedResult<T> = {
  value: T | null; //the expected deserialized value. If deserialiation fails the value is expected to be null
  errorMessage?: string;
};

/**
 * TextInputFilter is a utility class designed for handling stateful input validation.
 * It is primarily applicable to input fields that have a valid state, i.e. the text input can be deserialized into a value of a specific type.
 *
 * Functionalities:
 * - Evaluates and suggests the validity of the entered text (`isInvalid`).
 * - Provides error messages related to the input text (`errorMessage`).
 *
 * Expected Behavior:
 * - When the text input is empty, the state is considered valid, although the text input is not deserializable.
 * - If the text input cannot be deserialized, the state is marked as invalid, and an appropriate error message is displayed. This reacts as the user types.
 * - If the model of the field is updated independently of the text input (e.g., through another process or operation),
 *   the input text should be updated accordingly to reflect the changed value.
 *
 * Usage:
 * Instances of this class are typically created within a component and often used in conjunction with the BoxelInput component.
 *
 * Examples:
 * See the implementation in `ethereum-address.ts` and `big-integer.ts` for practical usage.
 */
export class TextInputFilter<T> {
  constructor(
    private getValue: () => T | null,
    private setValue: (val: T | null | undefined) => void,
    private deserialize: (
      inputValue: string | null | undefined
    ) => DeserializedResult<T>,
    private serialize: (val: T | null | undefined) => string | undefined = (
      v
    ) => (!v ? undefined : String(v))
  ) {}
  @tracked _lastEditedInputValue: string | undefined;
  @tracked _errorMessage: string | undefined;

  get asString(): string {
    let serialized = this.serialize(this.getValue());
    if (serialized) {
      return serialized;
    }
    return this._lastEditedInputValue || '';
  }

  get isInvalid() {
    return this.asString.length > 0 && this.getValue() == null;
  }

  get errorMessage(): string | undefined {
    if (this.isInvalid) {
      return this._errorMessage;
    }
    return;
  }

  onInput = async (inputVal: string) => {
    let deserialized = this.deserialize(inputVal);
    this.setValue(deserialized.value);
    this._lastEditedInputValue = inputVal;
    this._errorMessage = deserialized.errorMessage;
  };
}
