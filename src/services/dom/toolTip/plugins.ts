/**
 * tippy.js plugin that lazily computes tooltip content on show via a custom
 * `dynContent` prop (used by the sidebar navigation tooltips).
 *
 * The top-level `name` MUST equal the custom prop name (`dynContent`): tippy's
 * `validateProps` whitelists a custom prop only when some plugin's top-level
 * `name` matches it, and `getExtendedPassedProps` reads the top-level
 * `name`/`defaultValue`. A mismatch (the plugin previously had no top-level
 * `name`) triggered the dev-only "`dynContent` is not a valid prop" warning.
 *
 * The lifecycle object returned by `fn` is dispatched by hook method key
 * (`onShow`), never by any `name` field on it — so no inner name is needed.
 */
export const enhancedContentFunction = {
  name: 'dynContent',
  fn: (instance: any) => ({
    onShow() {
      if (typeof instance.props.dynContent === 'function') {
        instance.setContent(instance.props.dynContent(instance.reference));
      }
    }
  })
};
