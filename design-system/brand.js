(function bindBrandName() {
  const PRODUCT_NAME = "OdoSoft";

  document.querySelectorAll("[data-brand-name]").forEach((element) => {
    element.textContent = PRODUCT_NAME;
  });
})();

