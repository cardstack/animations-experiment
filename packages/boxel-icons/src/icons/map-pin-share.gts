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
    class='icon icon-tabler icons-tabler-outline icon-tabler-map-pin-share'
    viewBox='0 0 24 24'
    ...attributes
  ><path stroke='none' d='M0 0h24v24H0z' /><path
      d='M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0'
    /><path
      d='M12.02 21.485a1.996 1.996 0 0 1-1.433-.585l-4.244-4.243a8 8 0 1 1 13.403-3.651M16 22l5-5M21 21.5V17h-4.5'
    /></svg>
</template>;

// @ts-expect-error this is the only way to set a name on a Template Only Component currently
IconComponent.name = 'map-pin-share';
export default IconComponent;
