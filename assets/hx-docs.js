(function () {
  var html = document.documentElement;
  var themeToggle = document.getElementById("themeToggle");
  var iconMoon = document.getElementById("iconMoon");
  var iconSun = document.getElementById("iconSun");
  var savedTheme = localStorage.getItem("hx-docs-theme");

  function applyLight() {
    html.classList.add("light");
    if (iconMoon) iconMoon.style.display = "none";
    if (iconSun) iconSun.style.display = "block";
    if (themeToggle) themeToggle.setAttribute("aria-label", "切换深色模式");
  }

  function applyDark() {
    html.classList.remove("light");
    if (iconMoon) iconMoon.style.display = "block";
    if (iconSun) iconSun.style.display = "none";
    if (themeToggle) themeToggle.setAttribute("aria-label", "切换浅色模式");
  }

  // 优先 localStorage，其次跟随系统偏好
  if (savedTheme === "light") {
    applyLight();
  } else if (!savedTheme && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
    applyLight();
  } else {
    applyDark();
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      if (html.classList.contains("light")) {
        applyDark();
        localStorage.setItem("hx-docs-theme", "dark");
      } else {
        applyLight();
        localStorage.setItem("hx-docs-theme", "light");
      }
    });
  }
})();

(function () {
  var sidebar = document.getElementById("sidebar");
  var sidebarToggle = document.getElementById("sidebarToggle");
  var backdrop = document.getElementById("sidebarBackdrop");
  var pageLinks = document.querySelectorAll(".sidebar a[data-page]");
  var currentFile = window.location.pathname.split("/").pop() || "hx-guide.html";

  pageLinks.forEach(function (link) {
    if (link.getAttribute("data-page") === currentFile) {
      link.classList.add("active-page");
    }
  });

  function setSidebar(open) {
    if (!sidebar) return;
    sidebar.classList.toggle("open", open);
    if (backdrop) backdrop.classList.toggle("open", open);
    if (sidebarToggle) {
      sidebarToggle.setAttribute("aria-expanded", open ? "true" : "false");
      sidebarToggle.setAttribute("aria-label", open ? "收起目录" : "展开目录");
    }
    localStorage.setItem("hx-docs-sidebar", open ? "open" : "closed");
  }

  if (sidebar && localStorage.getItem("hx-docs-sidebar") === "open" && window.innerWidth > 980) {
    setSidebar(true);
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", function () {
      setSidebar(!sidebar.classList.contains("open"));
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", function () {
      setSidebar(false);
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sidebar && sidebar.classList.contains("open")) {
      setSidebar(false);
      if (sidebarToggle) sidebarToggle.focus();
    }
  });

  document.querySelectorAll('.sidebar a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function () {
      if (window.innerWidth <= 980) {
        setSidebar(false);
      }
    });
  });

  var sectionLinks = Array.prototype.slice.call(
    document.querySelectorAll('.sidebar a[href^="#"]'),
  );

  if (sectionLinks.length === 0) return;

  var sections = sectionLinks
    .map(function (link) {
      var id = link.getAttribute("href").slice(1);
      var node = document.getElementById(id);
      return node ? { link: link, node: node } : null;
    })
    .filter(Boolean);

  function updateActiveSection() {
    var scrollTop = window.scrollY + 140;
    var current = null;

    sections.forEach(function (entry) {
      if (entry.node.offsetTop <= scrollTop) {
        current = entry;
      }
    });

    sectionLinks.forEach(function (link) {
      link.classList.remove("active-section");
    });

    if (current) {
      current.link.classList.add("active-section");
    }
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      updateActiveSection();
      ticking = false;
    });
  });

  updateActiveSection();
})();
