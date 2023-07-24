import TextAreaCard from 'https://cardstack.com/base/text-area';
import {
  Card,
  field,
  contains,
  linksTo,
} from 'https://cardstack.com/base/card-api';
import StringCard from 'https://cardstack.com/base/string';
import { BlogPost } from './blog-post';

export class PublishingPacket extends Card {
  static displayName = 'Publishing Packet';
  @field blogPost = linksTo(BlogPost);
  @field socialBlurb = contains(TextAreaCard);
  @field title = contains(StringCard, {
    computeVia: function (this: PublishingPacket) {
      return this.blogPost?.title ? `${this.blogPost?.title} Packet` : 'Packet';
    },
  });
}
