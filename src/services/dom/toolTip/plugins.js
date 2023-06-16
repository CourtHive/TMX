export const enhancedContentFunction = {
  fn: (instance) => ({
    name: 'dynamicContent',
    default: true,
    onShow() {
      if (typeof instance.props.dynContent === 'function') {
        instance.setContent(instance.props.dynContent(instance.reference));
      }
    }
  })
};
