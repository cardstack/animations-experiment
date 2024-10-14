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
    class='lucide lucide-triangle-stripes'
    viewBox='0 0 24 24'
    ...attributes
  ><path
      d='M13.75 4a2 2 0 0 0-3.5 0L2.2 18A2 2.1 0 0 0 4 21h16a2 2 0 0 0 1.75-3ZM7.5 9h9M5.5 13h13M3 17h18'
    /></svg>
</template>;

// @ts-expect-error this is the only way to set a name on a Template Only Component currently
IconComponent.name = 'triangle-stripes';
export default IconComponent;
