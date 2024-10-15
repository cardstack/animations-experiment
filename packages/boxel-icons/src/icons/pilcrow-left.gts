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
    class='lucide lucide-pilcrow-left'
    viewBox='0 0 24 24'
    ...attributes
  ><path
      d='M14 3v11M14 9h-3a3 3 0 0 1 0-6h9M18 3v11M22 18H2l4-4M6 22l-4-4'
    /></svg>
</template>;

// @ts-expect-error this is the only way to set a name on a Template Only Component currently
IconComponent.name = 'pilcrow-left';
export default IconComponent;
