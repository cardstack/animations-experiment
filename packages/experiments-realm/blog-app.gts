import { on } from '@ember/modifier';
import { action } from '@ember/object';
import type Owner from '@ember/owner';
import GlimmerComponent from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { restartableTask } from 'ember-concurrency';

import {
  CardDef,
  Component,
  realmURL,
  field,
  contains,
  StringField,
} from 'https://cardstack.com/base/card-api';

import {
  getCard,
  type LooseSingleCardDocument,
  relativeURL,
  ResolvedCodeRef,
} from '@cardstack/runtime-common';
import {
  type SortOption,
  sortByCardTitleAsc,
  SortMenu,
} from './components/sort';
import { type ViewOption, CardsGrid } from './components/grid';
import { TitleGroup, Layout, type LayoutFilter } from './components/layout';

import {
  BasicFitted,
  BoxelButton,
  FieldContainer,
  Pill,
  ViewSelector,
} from '@cardstack/boxel-ui/components';
import { eq } from '@cardstack/boxel-ui/helpers';
import { IconPlus } from '@cardstack/boxel-ui/icons';

import CategoriesIcon from '@cardstack/boxel-icons/hierarchy-3';
import BlogPostIcon from '@cardstack/boxel-icons/newspaper';
import BlogAppIcon from '@cardstack/boxel-icons/notebook';
import AuthorIcon from '@cardstack/boxel-icons/square-user';

import type { BlogPost } from './blog-post';

export const SORT_OPTIONS: SortOption[] = [
  {
    id: 'datePubDesc',
    displayName: 'Date Published',
    sort: [
      {
        by: 'createdAt',
        direction: 'desc',
      },
    ],
  },
  {
    id: 'lastUpdatedDesc',
    displayName: 'Last Updated',
    sort: [
      {
        by: 'lastModified',
        direction: 'desc',
      },
    ],
  },
  {
    id: 'cardTitleAsc',
    displayName: 'A-Z',
    sort: sortByCardTitleAsc,
  },
];

export const toISOString = (datetime: Date) => datetime.toISOString();

export const formatDatetime = (
  datetime: Date,
  opts: Intl.DateTimeFormatOptions,
) => {
  const Format = new Intl.DateTimeFormat('en-US', opts);
  return Format.format(datetime);
};

const or = function (item1: any, item2: any) {
  if (Boolean(item1)) {
    return item1;
  } else if (Boolean(item2)) {
    return item2;
  }
  return;
};

interface CardAdminViewSignature {
  Args: {
    cardId: string;
  };
  Element: HTMLElement;
}
class BlogAdminData extends GlimmerComponent<CardAdminViewSignature> {
  <template>
    {{#if this.resource.cardError}}
      Error: Could not load additional info
    {{else if this.resource.card}}
      <div class='blog-admin' ...attributes>
        {{#let this.resource.card as |card|}}
          <FieldContainer
            class='admin-data'
            @label='Publish Date'
            @vertical={{true}}
          >
            {{#if card.publishDate}}
              <time timestamp={{toISOString card.publishDate}}>
                {{this.formattedDate card.publishDate}}
              </time>
            {{else}}
              N/A
            {{/if}}
          </FieldContainer>
          <FieldContainer
            class='admin-data'
            @label='Last Updated'
            @vertical={{true}}
          >
            {{#if card.lastUpdated}}
              <time timestamp={{toISOString card.lastUpdated}}>
                {{this.formattedDate card.lastUpdated}}
              </time>
            {{else}}
              N/A
            {{/if}}
          </FieldContainer>
          <FieldContainer
            class='admin-data'
            @label='Word Count'
            @vertical={{true}}
          >
            {{if card.wordCount card.wordCount 0}}
          </FieldContainer>
          <FieldContainer class='admin-data' @label='Editor' @vertical={{true}}>
            {{this.editors}}
          </FieldContainer>
          <FieldContainer class='admin-data' @label='Status' @vertical={{true}}>
            <Pill class='status-pill'>{{card.status}}</Pill>
          </FieldContainer>
        {{/let}}
      </div>
    {{/if}}
    <style scoped>
      .blog-admin {
        display: inline-flex;
        flex-direction: column;
        gap: var(--boxel-sp);
      }
      .admin-data {
        --boxel-label-font: 600 var(--boxel-font-sm);
      }
      .status-pill {
        --pill-background-color: var(--boxel-200);
        font-weight: 400;
      }
    </style>
  </template>

  @tracked resource = getCard<BlogPost>(new URL(this.args.cardId));

  formattedDate = (datetime: Date) => {
    return formatDatetime(datetime, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour12: true,
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  get editors() {
    return this.resource.card && this.resource.card.editors.length > 0
      ? this.resource.card.editors
          .map((editor) =>
            editor.email ? `${editor.name} (${editor.email})` : editor.name,
          )
          .join(',')
      : 'N/A';
  }
}

class BlogAppTemplate extends Component<typeof BlogApp> {
  <template>
    <Layout
      @filters={{this.filters}}
      @activeFilter={{this.activeFilter}}
      @onFilterChange={{this.onFilterChange}}
    >
      <:sidebar>
        <TitleGroup
          @title={{or @model.title ''}}
          @tagline={{or @model.description ''}}
          @thumbnailURL={{or @model.thumbnailURL ''}}
          @icon={{@model.constructor.icon}}
          @element='header'
          aria-label='Sidebar Header'
        />
        {{#if @context.actions.createCard}}
          <BoxelButton
            class='sidebar-create-button'
            @kind='primary'
            @size='large'
            @disabled={{this.activeFilter.isCreateNewDisabled}}
            @loading={{this.createCard.isRunning}}
            {{on 'click' this.createNew}}
          >
            {{#unless this.createCard.isRunning}}
              <IconPlus
                class='sidebar-create-button-icon'
                width='15'
                height='15'
              />
            {{/unless}}
            New
            {{this.activeFilter.createNewButtonText}}
          </BoxelButton>
        {{/if}}
      </:sidebar>
      <:contentHeader>
        <h2 class='content-title'>{{this.activeFilter.displayName}}</h2>
        <ViewSelector
          @selectedId={{this.selectedView}}
          @onChange={{this.onChangeView}}
        />
        {{#if this.activeFilter.sortOptions.length}}
          {{#if this.selectedSort}}
            <SortMenu
              @options={{this.activeFilter.sortOptions}}
              @selected={{this.selectedSort}}
              @onSort={{this.onSort}}
            />
          {{/if}}
        {{/if}}
      </:contentHeader>
      <:grid>
        {{#if this.query}}
          <CardsGrid
            @selectedView={{this.selectedView}}
            @context={{@context}}
            @format={{if (eq this.selectedView 'card') 'embedded' 'fitted'}}
            @query={{this.query}}
            @realms={{this.realms}}
            class={{this.gridClass}}
          >
            <:meta as |card|>
              {{#if this.showAdminData}}
                <BlogAdminData @cardId={{card.url}} />
              {{/if}}
            </:meta>
          </CardsGrid>
        {{/if}}
      </:grid>
    </Layout>
    <style scoped>
      .sidebar-create-button {
        --icon-color: currentColor;
        --boxel-loading-indicator-size: 15px;
        gap: var(--boxel-sp-xs);
        font-weight: 600;
      }
      .sidebar-create-button-icon {
        flex-shrink: 0;
      }
      .sidebar-create-button :deep(.loading-indicator) {
        margin: 0;
      }

      .content-title {
        flex-grow: 1;
        margin: 0;
        font: 600 var(--boxel-font-lg);
        letter-spacing: var(--boxel-lsp-xxs);
      }
      :deep(.card-view.categories-grid) {
        --grid-card-height: 150px;
      }
    </style>
  </template>

  @tracked private selectedView: ViewOption = 'card';
  @tracked private activeFilter: LayoutFilter;
  @tracked private filters: LayoutFilter[] = [];

  constructor(owner: Owner, args: any) {
    super(owner, args);
    this.setFilters();
    this.activeFilter = this.filters[0];
  }

  private get gridClass() {
    if (this.activeFilter.displayName === 'Blog Posts') {
      return 'blog-posts-grid';
    } else if (this.activeFilter.displayName === 'Author Bios') {
      return 'author-bios-grid';
    } else if (this.activeFilter.displayName === 'Categories') {
      return 'categories-grid';
    }
    return '';
  }

  private setFilters() {
    let blogId = this.args.model.id;
    if (!blogId) {
      throw new Error('Missing blog id');
    }

    let makeQuery = (codeRef: ResolvedCodeRef) => {
      let relativeTo = relativeURL(
        new URL(blogId!),
        new URL(`${codeRef.module}/${codeRef.name}`),
        this.realms[0],
      );
      if (!relativeTo) {
        throw new Error('Missing relativeTo');
      }

      if (!blogId) {
        throw new Error('Missing blog id');
      }

      return {
        filter: {
          on: codeRef,
          any: [
            { eq: { 'blog.id': blogId } },
            { eq: { 'blog.id': relativeTo } },
          ],
        },
      };
    };

    this.filters = [
      {
        displayName: 'Blog Posts',
        icon: BlogPostIcon,
        createNewButtonText: 'Post',
        showAdminData: true,
        sortOptions: SORT_OPTIONS,
        query: makeQuery({
          name: 'BlogPost',
          module: new URL('./blog-post', import.meta.url).href,
        }),
      },
      {
        displayName: 'Author Bios',
        icon: AuthorIcon,
        createNewButtonText: 'Author',
        query: makeQuery({
          name: 'Author',
          module: new URL('./author', import.meta.url).href,
        }),
      },
      {
        displayName: 'Categories',
        icon: CategoriesIcon,
        createNewButtonText: 'Category',
        query: makeQuery({
          name: 'BlogCategory',
          module: new URL('./blog-category', import.meta.url).href,
        }),
      },
    ];
  }

  private get selectedSort() {
    if (!this.activeFilter.sortOptions?.length) {
      return;
    }
    return this.activeFilter.selectedSort ?? this.activeFilter.sortOptions[0];
  }

  private get showAdminData() {
    return this.activeFilter.showAdminData && this.selectedView === 'card';
  }

  private get realms() {
    return [this.args.model[realmURL]!];
  }

  private get query() {
    return {
      ...this.activeFilter.query,
      sort: this.selectedSort?.sort ?? sortByCardTitleAsc,
    };
  }

  @action private onChangeView(id: ViewOption) {
    this.selectedView = id;
  }

  @action private onSort(option: SortOption) {
    this.activeFilter.selectedSort = option;
    this.activeFilter = this.activeFilter;
  }

  @action private onFilterChange(filter: LayoutFilter) {
    this.activeFilter = filter;
  }

  @action private createNew() {
    this.createCard.perform();
  }

  private createCard = restartableTask(async () => {
    if (!this.activeFilter?.query?.filter) {
      throw new Error('Missing active filter');
    }
    let ref = (this.activeFilter.query.filter as TypedFilter).on;

    if (!ref) {
      throw new Error('Missing card ref');
    }
    let currentRealm = this.realms[0];
    let doc: LooseSingleCardDocument = {
      data: {
        type: 'card',
        relationships: {
          blog: {
            links: {
              self: this.args.model.id!,
            },
          },
        },
        meta: {
          adoptsFrom: ref,
        },
      },
    };
    await this.args.context?.actions?.createCard?.(ref, currentRealm, {
      realmURL: currentRealm,
      doc,
    });
  });
}

// TODO: BlogApp should extend AppCard
// Using type CardDef instead of AppCard from catalog because of
// the many type issues resulting from the lack types from catalog realm
export class BlogApp extends CardDef {
  @field website = contains(StringField);
  static displayName = 'Blog App';
  static icon = BlogAppIcon;
  static prefersWideFormat = true;
  static headerColor = '#fff500';

  static isolated = BlogAppTemplate;
  static fitted = class Fitted extends Component<typeof this> {
    <template>
      <BasicFitted
        class='fitted-blog'
        @thumbnailURL={{@model.thumbnailURL}}
        @iconComponent={{@model.constructor.icon}}
        @primary={{@model.title}}
        @secondary={{@model.website}}
      />
      <style scoped>
        .fitted-blog :deep(.card-description) {
          display: none;
        }

        @container fitted-card ((2.0 < aspect-ratio) and (400px <= width ) and (height < 115px)) {
          .fitted-blog {
            padding: var(--boxel-sp-xxxs);
            align-items: center;
          }
          .fitted-blog :deep(.thumbnail-section) {
            border: 1px solid var(--boxel-450);
            border-radius: var(--boxel-border-radius-lg);
            width: 40px;
            height: 40px;
            overflow: hidden;
          }
          .fitted-blog :deep(.card-thumbnail) {
            width: 100%;
            height: 100%;
          }
          .fitted-blog :deep(.card-type-icon) {
            width: 20px;
            height: 20px;
          }
          .fitted-blog :deep(.info-section) {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: var(--boxel-sp-xs);
          }
          .fitted-blog :deep(.card-title) {
            -webkit-line-clamp: 2;
            font: 600 var(--boxel-font-sm);
            letter-spacing: var(--boxel-lsp-xs);
          }
          .fitted-blog :deep(.card-display-name) {
            margin: 0;
            overflow: hidden;
          }
        }
      </style>
    </template>
  };
}
