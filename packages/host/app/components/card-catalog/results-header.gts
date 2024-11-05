import type { TemplateOnlyComponent } from '@ember/component/template-only';

import cssUrl from 'ember-css-url';

import { cn, eq, gt, not } from '@cardstack/boxel-ui/helpers';

import type { RealmInfo } from '@cardstack/runtime-common';

interface Signature {
  Args: {
    realm: RealmInfo;
    resultsCount: number;
  };
}

const CardCatalogResultsHeader: TemplateOnlyComponent<Signature> = <template>
  <header class='catalog-results-header'>
    <div
      style={{if @realm.iconURL (cssUrl 'background-image' @realm.iconURL)}}
      class={{cn 'realm-icon' realm-icon--empty=(not @realm.iconURL)}}
    />
    <span class='realm-name' data-test-realm-name>
      {{@realm.name}}
    </span>
    <span class='results-count' data-test-results-count>
      {{#if (gt @resultsCount 1)}}
        {{@resultsCount}}
        results
      {{else if (eq @resultsCount 1)}}
        1 result
      {{else if (eq @resultsCount 0)}}
        No results
      {{/if}}
    </span>
  </header>

  <style scoped>
    .catalog-results-header {
      --realm-icon-size: 1.25rem;
      display: flex;
      align-items: center;
      gap: var(--boxel-sp-xs);
    }
    .realm-icon {
      width: var(--realm-icon-size);
      height: var(--realm-icon-size);
      background-size: contain;
      background-position: center;
    }
    .realm-icon--empty {
      border: 1px solid var(--boxel-dark);
      border-radius: 100px;
    }
    .realm-name {
      display: inline-block;
      font: 600 var(--boxel-font);
    }
    .results-count {
      display: inline-block;
      font: var(--boxel-font);
    }
  </style>
</template>;

export default CardCatalogResultsHeader;
