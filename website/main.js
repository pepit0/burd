(function () {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const nav = document.getElementById("site-nav");
  const menuToggle = document.getElementById("menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");

  function setNavScrolled() {
    if (!nav) return;
    nav.classList.toggle("is-scrolled", window.scrollY > 40);
  }

  window.addEventListener("scroll", setNavScrolled, { passive: true });
  setNavScrolled();

  function closeMobileMenu() {
    if (!menuToggle || !mobileMenu) return;
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open menu");
    menuToggle.querySelector(".icon-menu")?.removeAttribute("hidden");
    menuToggle.querySelector(".icon-close")?.setAttribute("hidden", "");
    mobileMenu.setAttribute("hidden", "");
    document.body.classList.remove("site-nav-menu-open");
  }

  function openMobileMenu() {
    if (!menuToggle || !mobileMenu) return;
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Close menu");
    menuToggle.querySelector(".icon-menu")?.setAttribute("hidden", "");
    menuToggle.querySelector(".icon-close")?.removeAttribute("hidden");
    mobileMenu.removeAttribute("hidden");
    document.body.classList.add("site-nav-menu-open");
  }

  menuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    if (isOpen) closeMobileMenu();
    else openMobileMenu();
  });

  mobileMenu?.querySelectorAll("a, button").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });

  document.addEventListener("click", (event) => {
    if (
      menuToggle?.getAttribute("aria-expanded") !== "true" ||
      !(event.target instanceof Node)
    ) {
      return;
    }
    if (mobileMenu?.contains(event.target) || menuToggle.contains(event.target)) {
      return;
    }
    closeMobileMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobileMenu();
  });

  document.querySelectorAll("[data-scroll-to]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-scroll-to");
      if (!id) return;
      closeMobileMenu();
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    });
  });

  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  document.querySelectorAll("[data-scanner]").forEach((scanner) => {
    const card = scanner.querySelector(".scanner-mockup__card");
    const confidence = card?.getAttribute("data-confidence") || "94";
    if (card) card.style.setProperty("--confidence", confidence + "%");

    function identify() {
      scanner.classList.add("is-identified");
    }

    function reset() {
      scanner.classList.remove("is-identified");
      window.setTimeout(identify, 1800);
    }

    window.setTimeout(identify, 1800);
    window.setInterval(reset, 5000);
  });

  const coverageData = {
    animal: [
      {
        icon: "rabbit",
        label: "Mammals",
        count: "5,400+ species",
      },
      {
        icon: "fish",
        label: "Fish & Marine",
        count: "3,700+ species",
      },
      {
        icon: "bug",
        label: "Insects",
        count: "12,000+ species",
      },
      {
        icon: "bird",
        label: "Reptiles & Amphibians",
        count: "2,100+ species",
      },
    ],
    habitat: [
      {
        icon: "tree",
        label: "Trees & Shrubs",
        count: "60,000+ species",
      },
      {
        icon: "bird",
        label: "Bird Nests",
        count: "All nest-building birds",
      },
      {
        icon: "egg",
        label: "Eggs & Clutches",
        count: "Colour, size, pattern",
      },
      {
        icon: "shell",
        label: "Dens & Burrows",
        count: "Footprint context",
      },
    ],
  };

  const icons = {
    rabbit:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 16a3 3 0 0 1 2.24 5" /><path d="M18 12h.01" /><path d="M18 21h-8a4 4 0 0 1-4-4 7 7 0 0 1 7-7h.2a3 3 0 0 0 3-3 1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1" /></svg>',
    fish:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z" /><path d="M18 12v.5a6 6 0 0 1-6 6v0a6 6 0 0 1-6-6v-.5" /></svg>',
    bug:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="16" height="12" x="4" y="6" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>',
    bird:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 7h.01" /><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.8-1.3" /><path d="M3 10l4.5 2" /><path d="M7 14l-4 2" /><path d="M14 6l1-3" /><path d="M18 8l1 2" /></svg>',
    tree:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z" /></svg>',
    egg:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12z" /></svg>',
    shell:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" /></svg>',
  };

  const coverageGrid = document.getElementById("coverage-grid");
  const coverageTabs = document.querySelectorAll(".coverage__tab");

  function renderCoverage(tab) {
    if (!coverageGrid) return;
    const isHabitat = tab === "habitat";
    coverageGrid.classList.toggle("is-habitat", isHabitat);
    const iconClass = isHabitat ? "coverage__card-icon--accent" : "coverage__card-icon--primary";

    coverageGrid.innerHTML = coverageData[tab]
      .map(
        (item, i) => `
        <article class="coverage__card reveal is-visible" style="--reveal-delay: ${i * 70}ms">
          <span class="coverage__card-icon ${iconClass}">${icons[item.icon]}</span>
          <h3>${item.label}</h3>
          <p>${item.count}</p>
        </article>`
      )
      .join("");
  }

  coverageTabs.forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      const tab = tabBtn.getAttribute("data-tab");
      if (!tab || tabBtn.classList.contains("coverage__tab--active")) return;

      coverageTabs.forEach((btn) => {
        btn.classList.remove("coverage__tab--active");
        btn.setAttribute("aria-selected", "false");
      });
      tabBtn.classList.add("coverage__tab--active");
      tabBtn.setAttribute("aria-selected", "true");
      renderCoverage(tab);
    });
  });

  const waitlistForm = document.getElementById("waitlist-form");
  const waitlistSuccess = document.getElementById("waitlist-success");
  const waitlistError = document.getElementById("waitlist-error");

  waitlistForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById("waitlist-email");
    if (!(emailInput instanceof HTMLInputElement) || !emailInput.value) return;

    const endpoint = waitlistForm.getAttribute("data-formspree-endpoint");
    const submitButton = waitlistForm.querySelector('button[type="submit"]');
    if (!(submitButton instanceof HTMLButtonElement)) return;

    waitlistError?.setAttribute("hidden", "");
    submitButton.disabled = true;
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = "Submitting...";

    try {
      if (!endpoint || endpoint.includes("YOUR_FORM_ID")) {
        throw new Error("Formspree endpoint is not configured");
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: emailInput.value.trim(),
          source: "burdapp.com waitlist",
        }),
      });

      if (!response.ok) {
        throw new Error(`Formspree request failed with status ${response.status}`);
      }

      waitlistForm.setAttribute("hidden", "");
      waitlistSuccess?.removeAttribute("hidden");
    } catch (_error) {
      waitlistError?.removeAttribute("hidden");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  });
})();
