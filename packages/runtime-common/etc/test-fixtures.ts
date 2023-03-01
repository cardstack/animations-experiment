export const cardSrc = `
import {
  contains,
  field,
  Component,
  Card,
} from "https://cardstack.com/base/card-api";
import StringCard from "https://cardstack.com/base/string";

export class Person extends Card {
  @field firstName = contains(StringCard);
  static isolated = class Isolated extends Component<typeof this> {
    <template>
      <h1><@fields.firstName /></h1>
    </template>
  };
}`.trim();

export function compiledCard(id = "null") {
  return `
var _class, _descriptor, _class2;

import { createTemplateFactory } from "@ember/template-factory";
import { setComponentTemplate } from "@ember/component";

function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'proposal-class-properties is enabled and runs after the decorators transform.'); }

import { contains, field, Component, Card } from "https://cardstack.com/base/card-api";
import StringCard from "https://cardstack.com/base/string";
export let Person = (_class = (_class2 = class Person extends Card {
  constructor(...args) {
    super(...args);

    _initializerDefineProperty(this, "firstName", _descriptor, this);
  }

}, _defineProperty(_class2, "isolated", setComponentTemplate(createTemplateFactory(
/*
  
      <h1><@fields.firstName /></h1>
    
*/
{
  "id": ${id},
  "block": "[[[10,\\"h1\\"],[12],[8,[30,1,[\\"firstName\\"]],null,null,null],[13]],[\\"@fields\\"],false,[]]",
  "moduleName": "(unknown template module)",
  "isStrictMode": true
}), class Isolated extends Component {})), _class2), (_descriptor = _applyDecoratedDescriptor(_class.prototype, "firstName", [field], {
  configurable: true,
  enumerable: true,
  writable: true,
  initializer: function () {
    return contains(StringCard);
  }
})), _class);
`.trim();
}
