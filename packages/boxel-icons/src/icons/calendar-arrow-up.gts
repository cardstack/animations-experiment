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
    class='lucide lucide-calendar-arrow-up'
    viewBox='0 0 24 24'
    ...attributes
  ><path d='m14 18 4-4 4 4M16 2v4M18 22v-8' /><path
      d='M21 11.343V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9M3 10h18M8 2v4'
    /></svg>
</template>;

// @ts-expect-error this is the only way to set a name on a Template Only Component currently
IconComponent.name = 'calendar-arrow-up';
export default IconComponent;
