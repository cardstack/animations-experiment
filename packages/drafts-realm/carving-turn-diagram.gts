import {
  CardDef,
  FieldDef,
  primitive,
  deserialize,
  BaseDefConstructor,
  BaseInstanceType,
  contains,
  containsMany,
  field,
} from 'https://cardstack.com/base/card-api';
import { Component } from 'https://cardstack.com/base/card-api';
import { RadioInput } from '@cardstack/boxel-ui/components';
import { fn, concat, get } from '@ember/helper';
import { not } from '@cardstack/boxel-ui/helpers';
import { BoardAnnotation } from './board-annotation';

// this allows multiple radio groups rendered on the page
// to stay independent of one another.
let groupNumber = 0;
class DiagramType extends FieldDef {
  static displayName = 'Carving Turn Diagram Type';
  static [primitive]: 'heel' | 'toe' | 'toe/heel';

  static async [deserialize]<T extends BaseDefConstructor>(
    this: T,
    val: any,
  ): Promise<BaseInstanceType<T>> {
    if (val === undefined || val === null) {
      return 'toe/heel' as BaseInstanceType<T>;
    }
    return val as BaseInstanceType<T>;
  }
  static embedded = class Embedded extends Component<typeof this> {
    <template>
      {{@model}}
    </template>
  };
  static edit = class Edit extends Component<typeof this> {
    <template>
      <div class='radio-group' data-test-radio-group={{@fieldName}}>
        <RadioInput
          @items={{this.items}}
          @groupDescription='Carving Turn Diagram Type'
          name='{{this.radioGroup}}'
          @checkedId={{this.checkedId}}
          @hideBorder={{true}}
          @disabled={{not @canEdit}}
          as |item|
        >
          <item.component @onChange={{fn @set item.data.id}}>
            {{item.data.text}}
          </item.component>
        </RadioInput>
      </div>
      <style></style>
    </template>

    private radioGroup = `__boxel_carving_turn_diagram_type${groupNumber++}__`;

    private items = [
      { id: 'toe/heel', text: 'Toe and Heel Turns' },
      { id: 'toe', text: 'Toe Turn' },
      { id: 'heel', text: 'Heel Turn' },
    ];

    get checkedId() {
      return this.args.model;
    }
  };
  static atom = class Atom extends Component<typeof this> {
    <template>
      {{@model}}
    </template>
  };
}
export class CarvingTurnDiagram extends CardDef {
  static displayName = 'Carving Turn Diagram';
  @field diagramType = contains(DiagramType);
  @field toeAnnotations = containsMany(BoardAnnotation);
  @field heelAnnotations = containsMany(BoardAnnotation);

  static isolated = class Isolated extends Component<typeof this> {
    get showToeTurn() {
      return (
        this.args.model.diagramType === 'toe/heel' ||
        this.args.model.diagramType === 'toe'
      );
    }
    get showHeelTurn() {
      return (
        this.args.model.diagramType === 'toe/heel' ||
        this.args.model.diagramType === 'heel'
      );
    }
    <template>
      <div class='title'><@fields.title /></div>
      <div class='description'><@fields.description /></div>
      <div class='container'>
        <div class='fall-line'>Fall Line
          <div class='arrow'></div>
        </div>
        {{#if this.showToeTurn}}
          <div class='toe turn'>
            {{#if @fields.toeAnnotations}}
              {{#each @fields.toeAnnotations as |annotation i|}}
                {{#let (get (get @model.toeAnnotations i) 'step') as |step|}}
                  <div class='step {{concat "step-" step}}'>
                    <div class='annotation'>step {{step}}</div>
                    <annotation />
                  </div>
                {{/let}}
              {{/each}}
            {{/if}}
          </div>
        {{/if}}
        {{#if this.showHeelTurn}}
          <div class='heel turn'>
            {{#if @fields.heelAnnotations}}
              {{#each @fields.heelAnnotations as |annotation i|}}
                {{#let (get (get @model.heelAnnotations i) 'step') as |step|}}
                  <div class='step {{concat "step-" step}}'>
                    <div class='annotation'>step {{step}}</div>
                    <annotation />
                  </div>
                {{/let}}
              {{/each}}
            {{/if}}
          </div>
        {{/if}}
      </div>

      <style>
        .title {
          width: 500px;
          margin: 2rem 2rem 0;
          font-weight: bold;
          font-size: 25px;
        }
        .description {
          margin: 1rem 2rem 0;
        }
        .turn {
          position: relative;
          width: 500px;
          height: 500px;
          margin: 0 auto;
        }
        .heel {
          top: -10px;
        }
        .turn:before {
          position: absolute;
          top: 0;
          left: 0;
          color: rgba(0, 0, 0, 0.15);
          font-size: 80px;
          text-align: center;
          line-height: 300px;
          border: 10px solid gray;
          width: calc(100% - 20px);
          height: calc(100% - 20px);
          background: rgba(0, 0, 0, 0.05);
          border-radius: 50%;
        }
        .turn:after {
          position: absolute;
          top: 0;
          left: 0;
          color: rgba(0, 0, 0, 0.15);
          font-size: 80px;
          text-align: center;
          line-height: 675px;
          border: 10px solid rgba(0, 0, 0, 0);
          background: rgba(0, 0, 0, 0.05);
          width: calc(100% - 20px);
          height: calc(100% - 20px);
          border-radius: 50%;
        }
        .toe:before {
          content: 'x+';
          clip-path: inset(-100% -100% -100% 50%);
          letter-spacing: 280px;
        }
        .heel:before {
          content: '+';
          clip-path: inset(-100% 50% -100% -100%);
          letter-spacing: 200px;
        }
        .toe:after {
          content: 'x-';
          clip-path: inset(50% -100% -100% 50%);
          letter-spacing: 280px;
        }
        .heel:after {
          content: '-';
          clip-path: inset(50% 50% -100% -100%);
          letter-spacing: 200px;
        }
        .container {
          position: relative;
          margin-top: 200px;
          margin-bottom: 200px;
        }
        .fall-line {
          position: absolute;
          top: 150px;
          left: 40%;
          font-weight: bold;
          color: rgba(0, 0, 0, 1);
          font-size: 23px;
          opacity: 0.5;
          transform: rotate(90deg);
        }
        .annotation {
          font-size: 18px;
          line-height: 50px;
        }
        .toe :deep(.board) {
          left: 270px;
        }
        .heel :deep(.board) {
          left: 0;
        }
        .heel :deep(.edge-angle) {
          top: 70px;
          left: 60px;
          transform: rotate(180deg);
        }
        .step {
          position: absolute;
          height: 50px;
          width: 600px;
          opacity: 0.6;
        }
        .toe .step {
          padding-left: 270px;
        }
        .heel .step {
        }
        .toe .step-0 {
          transform: rotate(-0.25turn);
          left: -60px;
          top: -80px;
        }
        .toe .step-1 {
          transform: rotate(-0.2turn);
          left: 31px;
          top: -67px;
        }
        .toe .step-2 {
          transform: rotate(-0.15turn);
          left: 111px;
          top: -24px;
        }
        .toe .step-3 {
          transform: rotate(-0.1turn);
          left: 180px;
          top: 40px;
        }
        .toe .step-4 {
          transform: rotate(-0.05turn);
          left: 225px;
          top: 121px;
        }
        .toe .step-5 {
          top: calc(50% - 25px);
          left: 50%;
        }
        .toe .step-6 {
          transform: rotate(0.05turn);
          left: 225px;
          top: 308px;
        }
        .toe .step-7 {
          transform: rotate(0.1turn);
          left: 183px;
          top: 391px;
        }
        .toe .step-8 {
          transform: rotate(0.15turn);
          left: 115px;
          top: 455px;
        }
        .toe .step-9 {
          transform: rotate(0.2turn);
          left: 33px;
          top: 498px;
        }
        .toe .step-10 {
          transform: rotate(0.25turn);
          left: -60px;
          top: 515px;
        }

        .heel .step-0 {
          transform: rotate(0.25turn);
          right: -60px;
          top: 108px;
        }
        .heel .step-1 {
          transform: rotate(0.2turn);
          right: -29px;
          top: 112px;
        }
        .heel .step-2 {
          transform: rotate(0.15turn);
          right: 5px;
          top: 125px;
        }
        .heel .step-3 {
          transform: rotate(0.1turn);
          right: 31px;
          top: 148px;
        }
        .heel .step-4 {
          transform: rotate(0.05turn);
          right: 40px;
          top: 182px;
        }
        .heel .step-5 {
          top: calc(50% - 25px);
          right: 46px;
        }
        .heel .step-6 {
          transform: rotate(-0.05turn);
          right: 30px;
          top: 245px;
        }
        .heel .step-7 {
          transform: rotate(-0.1turn);
          right: 17px;
          top: 271px;
        }
        .heel .step-8 {
          transform: rotate(-0.15turn);
          right: -2px;
          top: 294px;
        }
        .heel .step-9 {
          transform: rotate(-0.2turn);
          right: -29px;
          top: 312px;
        }
        .heel .step-10 {
          transform: rotate(-0.25turn);
          right: -60px;
          top: 306px;
        }
        .arrow {
          font-weight: inherit;
          font-size: inherit;
          position: absolute;
          top: 15px;
          right: -45px;
          width: 35px;
          height: 5px;
          background-color: rgba(0, 0, 0, 1);
        }
        .arrow::after,
        .arrow::before {
          content: '';
          position: absolute;
          width: 20px;
          height: 5px;
          right: -8px;
          background-color: rgba(0, 0, 0, 1);
        }
        .arrow::after {
          top: -6px;
          transform: rotate(45deg);
        }
        .arrow::before {
          top: 5px;
          transform: rotate(-45deg);
        }
      </style>
    </template>
  };

  static embedded = class Embedded extends Component<typeof this> {
    <template>
      <@fields.title />
    </template>
  };

  static atom = class Atom extends Component<typeof this> {
    <template>
      <@fields.title />
    </template>
  };
}
