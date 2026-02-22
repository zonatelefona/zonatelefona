document.addEventListener("DOMContentLoaded", () => {
  const popup = document.getElementById("order-popup");
  const closeBtn = popup.querySelector(".close");
  const buyBtns = document.querySelectorAll(".buy-btn");
  const form = document.getElementById("order-form");
  const success = document.getElementById("order-success");

  buyBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      popup.style.display = "block";
    });
  });

  closeBtn.addEventListener("click", () => {
    popup.style.display = "none";
    form.style.display = "block";
    success.style.display = "none";
  });

  window.addEventListener("click", e => {
    if(e.target === popup) {
      popup.style.display = "none";
      form.style.display = "block";
      success.style.display = "none";
    }
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    // Ovde možeš poslati podatke na backend ili email servis
    form.style.display = "none";
    success.style.display = "block";
  });
});