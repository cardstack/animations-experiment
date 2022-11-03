import Behavior, { Frame, timeToFrame } from '../behaviors/base';
import { parse } from '@cardstack/boxel-motion/utils/css-to-unit-value';

export type Value = string | number;
export type CompositeValue = { [key: string]: Value };
export type Keyframe = {
  [k: string]: Value;
};

type BaseValueOptions = {
  transferVelocity: boolean;
};

export default class BaseValue {
  private previousValue: Value;
  private currentValue: Value;
  private velocity = 0; // velocity between behaviors
  private lastFrame?: Frame;
  private previousFramesFromTime?: Frame[];

  private property: string;
  private behavior?: Behavior;
  private delay = 0;
  private duration = 0;
  private transferVelocity = true;

  constructor(
    property: string,
    value: Value,
    { transferVelocity }: BaseValueOptions = { transferVelocity: true }
  ) {
    this.property = property;
    this.previousValue = this.currentValue = value;
    this.transferVelocity = transferVelocity;
  }

  /**
   * E.g. spring, easing function
   * @param behavior
   * @param value
   * @param duration
   * @param delay
   * @param time
   */
  applyBehavior(
    behavior: Behavior,
    value: Value,
    duration: number,
    delay?: number,
    time?: number,
    velocity?: number,
    _previousFrames: Frame[] = this.frames
  ): void {
    let previousFrames = _previousFrames ?? this.frames;
    this.velocity = velocity ?? 0;

    if (time) {
      // we don't currently interpolate between frames, we find the closest frame
      let frame = Math.min(previousFrames.length - 1, timeToFrame(time));

      if (previousFrames[frame]) {
        this.currentValue = previousFrames[frame]!.value;
        this.velocity = previousFrames[frame]!.velocity;

        if (this.transferVelocity) {
          this.lastFrame = previousFrames[frame - 1];
          this.previousFramesFromTime = previousFrames.slice(
            frame,
            previousFrames.length
          );
        }
      }
    } else {
      this.previousFramesFromTime = undefined;
    }

    this.previousValue = this.currentValue;
    this.currentValue = value;
    this.duration = duration;
    this.behavior = behavior;
    this.delay = delay ?? 0;
  }

  get previousAsNumber(): number {
    if (typeof this.previousValue === 'number') {
      return this.previousValue;
    }

    return Number.parseFloat(this.previousValue);
  }

  get currentAsNumber(): number {
    if (typeof this.currentValue === 'number') {
      return this.currentValue;
    }

    return Number.parseFloat(this.currentValue);
  }

  get currentUnit(): string {
    return parse(this.currentValue).unit;
  }

  get frames(): Frame[] {
    return (
      this.behavior?.toFrames({
        from: this.previousAsNumber,
        to: this.currentAsNumber,
        duration: this.duration,
        velocity: this.velocity,
        delay: this.delay,
        lastFrame: this.lastFrame,
        previousFramesFromTime: this.previousFramesFromTime,
      }) ?? []
    );
  }

  get keyframes(): Keyframe[] {
    return this.frames.map(
      ({ value }) =>
        ({
          [this.property]: this.currentUnit
            ? `${value}${this.currentUnit}`
            : value,
        } as Keyframe)
    );
  }
}
