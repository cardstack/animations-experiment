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
    class='lucide lucide-axe'
    viewBox='0 0 24 24'
    ...attributes
  ><path d='m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9' /><path
      d='M15 13 9 7l4-4 6 6h3a8 8 0 0 1-7 7z'
    /></svg>
</template>;

// @ts-expect-error this is the only way to set a name on a Template Only Component currently
IconComponent.name = 'axe';
export default IconComponent;
