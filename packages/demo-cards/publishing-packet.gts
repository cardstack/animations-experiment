import TextAreaCard from 'https://cardstack.com/base/text-area';
import {
  Card,
  field,
  contains,
  linksTo,
} from 'https://cardstack.com/base/card-api';
import { BlogPost } from './blog-post';

export class PublishingPacket extends Card {
  @field blogPost = linksTo(BlogPost);
  @field socialBlurb = contains(TextAreaCard);
}
