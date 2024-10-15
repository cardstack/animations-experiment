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
    class='icon icon-tabler icons-tabler-outline icon-tabler-battery-exclamation'
    viewBox='0 0 24 24'
    ...attributes
  ><path stroke='none' d='M0 0h24v24H0z' /><path
      d='M9 17h8a2 2 0 0 0 2-2v-.5c0-.276.224-.5.5-.5s.5-.224.5-.5v-3c0-.276-.224-.5-.5-.5s-.5-.224-.5-.5V9a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3M5 16v3M5 22v.01'
    /></svg>
</template>;

// @ts-expect-error this is the only way to set a name on a Template Only Component currently
IconComponent.name = 'battery-exclamation';
export default IconComponent;
