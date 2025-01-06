import {
  CardDef,
  field,
  linksToMany,
} from 'https://cardstack.com/base/card-api';
import { Component } from 'https://cardstack.com/base/card-api';
import { Product as ProductCard, EmbeddedProductComponent } from './product';
import { MonetaryAmountAtom } from './monetary-amount';
import GlimmerComponent from '@glimmer/component';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { BoxelInput } from '@cardstack/boxel-ui/components';
import ListIcon from '@cardstack/boxel-icons/list';

interface FeaturedProductComponentSignature {
  Args: {
    model: ProductCard | undefined;
    viewProduct: (arg0: ProductCard | undefined) => void;
  };
}

class FeaturedProductComponent extends GlimmerComponent<FeaturedProductComponentSignature> {
  <template>
    <div class='product'>
      <button {{on 'click' (fn @viewProduct @model)}}>
        <img src={{@model.thumbnailURL}} alt={{@model.title}} />
      </button>
      <div>
        <div class='seller'>
          {{@model.seller.title}}
        </div>
        <div class='title'>
          {{@model.title}}
        </div>
        <div class='price'>
          <MonetaryAmountAtom @model={{@model.unitPrice}} />
        </div>
        <button {{on 'click' (fn @viewProduct @model)}}>Shop this item</button>
      </div>
    </div>
    <style scoped>
      .product {
        display: grid;
        grid-template-columns: 1.5fr 2.5fr;
        grid-gap: var(--boxel-sp);
      }
      img {
        border-radius: 10px;
        display: block;
        max-width: 100%;
        aspect-ratio: 1.7;
        object-fit: cover;
      }
      .seller {
        margin-top: 6px;
        font-size: 14px;
      }
      .title {
        margin-top: 6px;
        font-weight: 500;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .price {
        color: green;
      }
      .title,
      .price {
        font-weight: 600;
        font-size: 18px;
        line-height: 24px;
      }
      button {
        margin-top: 10px;
        border-radius: 20px;
        background: black;
        color: white;
        font-weight: 500;
        font-size: 14px;
        padding: 7px 24px;
        border: 0;
      }
    </style>
  </template>
}

class Isolated extends Component<typeof ProductList> {
  get featuredProduct() {
    return this.filteredProducts?.[0];
  }

  get productsForGrid() {
    return this.filteredProducts?.slice(1) || [];
  }

  get filteredProducts() {
    let allProducts = this.args.model.products || [];
    let { filterText } = this;
    if (!filterText) return allProducts;
    return allProducts.filter((product) => {
      return product.title.toLowerCase().includes(filterText);
    });
  }

  // @ts-ignore TS1206: Decorators are not valid here.
  @action
  viewProduct(model: ProductCard | undefined) {
    if (model && this.args.context?.actions?.viewCard) {
      this.args.context.actions.viewCard(model);
    } else {
      console.warn('Product card opening functionality is not available here.');
    }
  }

  @tracked filterText = '';

  @action
  updateFilterText(event: Event) {
    this.filterText = (event.target as HTMLInputElement).value.toLowerCase();
  }

  <template>
    <div>
      <div class='search-container'>
        <BoxelInput
          @type='search'
          class='search-input'
          placeholder='Filter products...'
          @value={{this.filterText}}
          {{on 'input' this.updateFilterText}}
        />
      </div>
      <div class='products-container'>
        <div class='featured'>
          <FeaturedProductComponent
            @viewProduct={{this.viewProduct}}
            @model={{this.featuredProduct}}
          />
        </div>
        <div class='grid'>
          {{#each this.productsForGrid as |product|}}
            <div class='grid-item'>
              <EmbeddedProductComponent
                @model={{product}}
                {{on 'click' (fn this.viewProduct product)}}
                class='grid-item-product'
              />
            </div>
          {{/each}}
        </div>
      </div>
    </div>
    <style scoped>
      .search-container {
        background-image: url(https://i.imgur.com/PQuDAEo.jpg);
        padding: var(--boxel-sp);
      }
      .search-input {
        background-color: white;
        color: black;
      }
      .search-input::placeholder {
        color: var(--boxel-dark) !important;
      }
      .products-container {
        padding: var(--boxel-sp);
      }
      .featured {
        padding-bottom: var(--boxel-sp);
        border-bottom: 2px solid black;
        margin-bottom: var(--boxel-sp);
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        grid-gap: 0;
      }
      .grid-item {
        border-bottom: 1px solid var(--boxel-200);
        padding-bottom: var(--boxel-sp-xxs);
        margin-bottom: var(--boxel-sp-xs);
        padding-right: var(--boxel-sp);
      }
      .grid-item:nth-child(4) {
        padding-right: 0;
      }
      .grid-item-product {
        cursor: pointer;
      }
    </style>
  </template>
}

export class ProductList extends CardDef {
  @field products = linksToMany(ProductCard);
  static displayName = 'Product List';
  static icon = ListIcon;

  static isolated = Isolated;

  /*

  static embedded = class Embedded extends Component<typeof this> {
    <template></template>
  }

  static atom = class Atom extends Component<typeof this> {
    <template></template>
  }

  static edit = class Edit extends Component<typeof this> {
    <template></template>
  }
















  */
}
