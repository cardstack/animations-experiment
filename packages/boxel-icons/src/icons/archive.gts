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
    class='lucide lucide-archive'
    viewBox='0 0 24 24'
    ...attributes
  ><rect width='20' height='5' x='2' y='3' rx='1' /><path
      d='M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4'
    /></svg>
</template>;

// @ts-expect-error this is the only way to set a name on a Template Only Component currently
IconComponent.name = 'archive';
export default IconComponent;
