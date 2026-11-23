(function bindBrandName() {
  const PRODUCT_NAME = "Turnos Odontología";

  document.querySelectorAll("[data-brand-name]").forEach((element) => {
    element.textContent = PRODUCT_NAME;
  });
})();

