import { BaseDef as BDef, contains } from 'https://cardstack.com/base/card-api';
import CardDef from 'https://cardstack.com/base/card-def';
import FieldDef from 'https://cardstack.com/base/field-def';
import StringCard from 'https://cardstack.com/base/string';
import NumberCard from 'https://cardstack.com/base/number';

export const exportedVar = 'exported var';

export { StringCard as StrCard };

export { FieldDef as FDef, CardDef, contains, BDef };

export * from './in-this-file'; //Will not display inside "in-this-file"

export default NumberCard;

export { Person as Human } from './person';

export { default as Date } from 'https://cardstack.com/base/date';
