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
    class='icon icon-tabler icons-tabler-outline icon-tabler-eye-edit'
    viewBox='0 0 24 24'
    ...attributes
  ><path stroke='none' d='M0 0h24v24H0z' /><path
      d='M10 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0'
    /><path
      d='M11.192 17.966C7.95 17.686 5.22 15.697 3 12c2.4-4 5.4-6 9-6 3.326 0 6.14 1.707 8.442 5.122M18.42 15.61a2.1 2.1 0 0 1 2.97 2.97L18 22h-3v-3l3.42-3.39z'
    /></svg>
</template>;

// @ts-expect-error this is the only way to set a name on a Template Only Component currently
IconComponent.name = 'eye-edit';
export default IconComponent;
