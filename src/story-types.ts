import type { Args, StoryObj as ServerStoryObj } from "@storybook/server";

// Every type from `@storybook/server` (Meta, Preview, Parameters, ...). The XP variants declared
// below take precedence over the ones of the same name, as a local export shadows a star re-export.
export type * from "@storybook/server";

type DateTimeLike = {
  getDayOfMonth(): number;
};

type RegionLike = {
  name: string;
  components: unknown[];
};

type SimpleRegion = {
  name?: string;
  components?: (SimplePartComponent | SimpleLayoutComponent)[];
};

type SimplePartComponent = {
  descriptor: string;
  path: string;
  type?: "part";
  config?: unknown;
};

type SimpleLayoutComponent = {
  descriptor: string;
  path: string;
  type?: "layout";
  config?: unknown;
  regions?: Record<string, SimpleRegion>;
};

/** Java date/time values are passed to the server as strings. */
export type RemoveJavaTypes<TFreemarkerParams> = {
  [Key in keyof TFreemarkerParams]: TFreemarkerParams[Key] extends DateTimeLike | undefined
    ? string
    : TFreemarkerParams[Key];
};

/** A `Region` is described by its components, which the server renders. */
export type SimplifyRegion<TFreemarkerParams> = {
  [Key in keyof TFreemarkerParams]: TFreemarkerParams[Key] extends RegionLike | undefined
    ? SimpleRegion
    : TFreemarkerParams[Key];
};

/**
 * `@storybook/server`'s `StoryObj`, except that the args can be typed with the same model the
 * template gets in XP: Java dates become strings, and regions take a simplified component list.
 */
export type StoryObj<TArgs = Args> = ServerStoryObj<RemoveJavaTypes<SimplifyRegion<TArgs>>>;
