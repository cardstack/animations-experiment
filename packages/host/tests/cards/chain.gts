
import { contains, field, Card } from "https://cardstack.com/base/card-api";
import StringCard from "https://cardstack.com/base/string";
import IntegerCard from "https://cardstack.com/base/integer";

let CHAIN_IDS: Record<string, number> = {
  "Ethereum Mainnet": 1,
  "Gnosis Chain": 100,
  "Polygon": 137
}
export class Chain extends Card {
  @field name = contains(StringCard);
  @field chainId = contains(IntegerCard, { computeVia:
    function(this: Chain) { return CHAIN_IDS[this.name]; }
  });
}