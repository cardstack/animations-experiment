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
    class='lucide lucide-monitor-x'
    viewBox='0 0 24 24'
    ...attributes
  ><path d='m14.5 12.5-5-5M9.5 12.5l5-5' /><rect
      width='20'
      height='14'
      x='2'
      y='3'
      rx='2'
    /><path d='M12 17v4M8 21h8' /></svg>
</template>;

// @ts-expect-error this is the only way to set a name on a Template Only Component currently
IconComponent.name = 'monitor-x';
export default IconComponent;
