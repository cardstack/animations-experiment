// This file is auto-generated by 'pnpm rebuild:all'
import type { TemplateOnlyComponent } from '@ember/component/template-only';

import type { Signature } from '../types.ts';

const IconComponent: TemplateOnlyComponent<Signature> = <template>
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width='24'
    height='24'
    fill='none'
    stroke='currentColor'
    stroke-linecap='round'
    stroke-linejoin='round'
    stroke-width='2'
    class='icon icon-tabler icons-tabler-outline icon-tabler-mood-heart'
    viewBox='0 0 24 24'
    ...attributes
  ><path stroke='none' d='M0 0h24v24H0z' /><path
      d='M21 12a9 9 0 1 0-8.012 8.946M9 10h.01M15 10h.01'
    /><path
      d='M9.5 15a3.59 3.59 0 0 0 2.774.99M18.994 21.5l2.518-2.58a1.74 1.74 0 0 0 .004-2.413 1.627 1.627 0 0 0-2.346-.005l-.168.172-.168-.172a1.627 1.627 0 0 0-2.346-.004 1.74 1.74 0 0 0-.004 2.412l2.51 2.59z'
    /></svg>
</template>;

// @ts-expect-error this is the only way to set a name on a Template Only Component currently
IconComponent.name = 'mood-heart';
export default IconComponent;
