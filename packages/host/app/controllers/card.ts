import Controller from '@ember/controller';
import { withPreventDefault } from '../helpers/with-prevent-default';
import { service } from '@ember/service';
import type RouterService from '@ember/routing/router-service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import stringify from 'safe-stable-stringify';
import { ComponentLike } from '@glint/template';
import { Model } from '@cardstack/host/routes/card';
import { registerDestructor } from '@ember/destroyable';
import type { Query } from '@cardstack/runtime-common/query';
import { getSearchResults, type Search } from '../resources/search';
import OperatorModeStateService, {
  SerializedState as OperatorModeSerializedState,
} from '@cardstack/host/services/operator-mode-state-service';

export default class CardController extends Controller {
  queryParams = ['operatorModeState', 'operatorModeEnabled'];

  isolatedCardComponent: ComponentLike | undefined;
  withPreventDefault = withPreventDefault;
  @service declare router: RouterService;
  @tracked operatorModeEnabled = false;
  @tracked model: Model | undefined;
  @tracked operatorModeState: string | null = null;
  @service declare operatorModeStateService: OperatorModeStateService;

  constructor(args: any) {
    super(args);
    (globalThis as any)._CARDSTACK_CARD_SEARCH = this;
    registerDestructor(this, () => {
      delete (globalThis as any)._CARDSTACK_CARD_SEARCH;
    });
  }

  get getIsolatedComponent() {
    if (this.model) {
      return this.model.constructor.getComponent(this.model, 'isolated');
    }

    return null;
  }

  getCards(query: Query): Search {
    return getSearchResults(this, () => query);
  }

  @action
  toggleOperatorMode() {
    this.operatorModeEnabled = !this.operatorModeEnabled;

    if (this.operatorModeEnabled) {
      // When entering operator mode, put the current card on the stack
      this.operatorModeState = stringify({
        stacks: [
          [
            {
              type: 'card',
              id: this.model?.id,
              format: 'isolated',
            },
          ],
        ],
      } as OperatorModeSerializedState)!;
    } else {
      this.operatorModeState = null;
    }
  }

  @action
  closeOperatorMode() {
    this.operatorModeEnabled = false;
  }
}
