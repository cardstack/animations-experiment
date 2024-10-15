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
    class='icon icon-tabler icons-tabler-outline icon-tabler-chart-dots'
    viewBox='0 0 24 24'
    ...attributes
  ><path stroke='none' d='M0 0h24v24H0z' /><path d='M3 3v18h18' /><path
      d='M7 9a2 2 0 1 0 4 0 2 2 0 1 0-4 0M17 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0M12 15a2 2 0 1 0 4 0 2 2 0 1 0-4 0M10.16 10.62l2.34 2.88M15.088 13.328l2.837-4.586'
    /></svg>
</template>;

// @ts-expect-error this is the only way to set a name on a Template Only Component currently
IconComponent.name = 'chart-dots';
export default IconComponent;
