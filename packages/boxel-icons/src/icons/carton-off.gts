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
    class='lucide lucide-carton-off'
    viewBox='0 0 24 24'
    ...attributes
  ><path d='M14.1 8.5 16 6V3c0-.6-.4-1-1-1H9' /><path
      d='M11.7 6H16l3 4v3.3M2 2l20 20M19 19v1a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V10l2.1-2.9M13 13v9'
    /></svg>
</template>;

// @ts-expect-error this is the only way to set a name on a Template Only Component currently
IconComponent.name = 'carton-off';
export default IconComponent;
