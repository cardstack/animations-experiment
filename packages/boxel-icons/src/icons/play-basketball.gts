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
    class='icon icon-tabler icons-tabler-outline icon-tabler-play-basketball'
    viewBox='0 0 24 24'
    ...attributes
  ><path stroke='none' d='M0 0h24v24H0z' /><path
      d='M10 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0M5 21l3-3 .75-1.5M14 21v-4l-4-3 .5-6'
    /><path d='m5 12 1-3 4.5-1 3.5 3 4 1' /><path
      fill='currentColor'
      d='M18.5 16a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z'
    /></svg>
</template>;

// @ts-expect-error this is the only way to set a name on a Template Only Component currently
IconComponent.name = 'play-basketball';
export default IconComponent;
