(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const header = $("[data-elevate]");
  const navToggle = $(".nav__toggle");
  const navLinks = $("[data-nav-links]");
  const toast = $(".toast");
  const toastText = $("[data-toast-text]");
  const apiMeta = document.querySelector('meta[name="api-base"]');
  const rawApiBase = apiMeta?.getAttribute("content")?.trim() || "/api";
  const normalizedApiBase = rawApiBase.replace(/\/+$/, "");

  function getApiUrl(path) {
    const cleanedPath = path.replace(/^\/+/, "");
    if (!normalizedApiBase) return `/${cleanedPath}`;
    return `${normalizedApiBase}/${cleanedPath}`;
  }

  function showToast(message) {
    if (!toast || !toastText) return;
    toastText.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => (toast.hidden = true), 1600);
  }

  function closeNav() {
    if (!navLinks || !navToggle) return;
    navLinks.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  }

  function openNav() {
    if (!navLinks || !navToggle) return;
    navLinks.classList.add("is-open");
    navToggle.setAttribute("aria-expanded", "true");
  }

  navToggle?.addEventListener("click", () => {
    const isOpen = navLinks?.classList.contains("is-open");
    isOpen ? closeNav() : openNav();
  });

  navLinks?.addEventListener("click", (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && t.tagName === "A") closeNav();
  });

  document.addEventListener("click", (e) => {
    if (!navLinks || !navToggle) return;
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (navLinks.contains(target) || navToggle.contains(target)) return;
    closeNav();
  });

  window.addEventListener("scroll", () => {
    header?.classList.toggle("is-elevated", window.scrollY > 8);
  });

  // Reveal
  const revealEls = $$("section, .glass").filter((el) => !el.classList.contains("is-visible"));
  revealEls.forEach((el) => el.classList.add("reveal"));

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.12 }
  );
  revealEls.forEach((el) => io.observe(el));

  // Count-up stats
  const statEls = $$(".stat[data-count]");
  const countIO = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        const target = Number(el.getAttribute("data-count") || "0");
        const out = $(".count", el);
        if (!out) continue;

        const duration = 900;
        const start = performance.now();

        function tick(now) {
          const p = Math.min(1, (now - start) / duration);
          const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
          out.textContent = String(v);
          if (p < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
        countIO.unobserve(el);
      }
    },
    { threshold: 0.6 }
  );
  statEls.forEach((el) => countIO.observe(el));

  // Filter work
  const filterBtns = $$(".chip-btn[data-filter]");
  const workGrid = $("[data-work-grid]");
  function applyFilter(kind) {
    if (!workGrid) return;
    const cards = $$(".work__card", workGrid);
    cards.forEach((c) => {
      const k = c.getAttribute("data-kind") || "all";
      c.style.display = kind === "all" || k === kind ? "" : "none";
    });
  }
  filterBtns.forEach((b) => {
    b.addEventListener("click", () => {
      filterBtns.forEach((x) => x.classList.remove("is-active"));
      b.classList.add("is-active");
      applyFilter(b.getAttribute("data-filter") || "all");
    });
  });

  // Modal
  const modal = $("#workModal");
  const modalTitle = $("#modalTitle");
  const modalDesc = $("#modalDesc");
  const modalStack = $("#modalStack");
  const modalLink = $("#modalLink");

  function openModal(data) {
    if (!modal) return;
    if (modalTitle) modalTitle.textContent = data.title;
    if (modalDesc) modalDesc.textContent = data.desc;
    if (modalStack) modalStack.textContent = data.stack;
    if (modalLink) {
      modalLink.textContent = data.linkText || "Open";
      modalLink.href = data.link || "#";
    }
    modal.showModal();
  }

  $$("[data-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openModal({
        title: btn.getAttribute("data-modal") || "Project",
        desc: btn.getAttribute("data-desc") || "",
        stack: btn.getAttribute("data-stack") || "",
        link: btn.getAttribute("data-link") || "#",
        linkText: "Open",
      });
    });
  });

  $$("[data-close-modal]").forEach((b) => b.addEventListener("click", () => modal?.close()));
  modal?.addEventListener("click", (e) => {
    const rect = modal.getBoundingClientRect();
    const inDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;
    if (!inDialog) modal.close();
  });

  // Copy buttons
  $$("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.getAttribute("data-copy") || "";
      try {
        await navigator.clipboard.writeText(value);
        showToast("Copied: " + value);
      } catch {
        showToast("Copy failed");
      }
    });
  });

  // Contact form -> backend (/api/contact)
  const form = $("#contactForm");
  const note = $(".form__note");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const message = String(fd.get("message") || "").trim();

    if (!name || !email || !message) {
      if (note) note.textContent = "Please fill in all fields.";
      return;
    }

    if (note) note.textContent = "Sending…";
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch(getApiUrl("contact"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        const msg = data.error || "Failed to send. Please try again later.";
        if (note) note.textContent = msg;
        showToast(msg);
        return;
      }

      form.reset();
      if (note) note.textContent = "Message sent. Thank you!";
      showToast("Message sent.");
    } catch {
      if (note) note.textContent = "Network error. Please try again.";
      showToast("Network error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
