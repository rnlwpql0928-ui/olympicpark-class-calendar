/* 밝게·어둡게.
 * 고른 값은 기억한다(같은 주소의 다른 화면과 함께 쓴다). 고른 적이 없으면 기기 설정을 따른다(스타일의 prefers-color-scheme).
 * 머리에서 먼저 읽혀 첫 화면이 그려지기 전에 data-theme 를 붙인다. 단추(#theme)의 이름은 data-dark·data-light 에서 읽는다.
 */
(function () {
  "use strict";
  var KEY = "kspo_theme", root = document.documentElement;
  function stored() { try { var v = localStorage.getItem(KEY); return v === "dark" || v === "light" ? v : null; } catch (e) { return null; } }
  function isDark() { var a = root.getAttribute("data-theme"); return a ? a === "dark" : !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); }
  function paint() {
    var b = document.getElementById("theme"); if (!b) return;
    var d = isDark(), label = d ? b.dataset.light : b.dataset.dark;
    b.setAttribute("aria-pressed", String(d)); if (label) { b.setAttribute("aria-label", label); b.title = label; }
  }
  function apply(v) { if (v) root.setAttribute("data-theme", v); else root.removeAttribute("data-theme"); paint(); }
  function set(dark) {
    root.classList.add("theming"); apply(dark ? "dark" : "light");
    try { localStorage.setItem(KEY, dark ? "dark" : "light"); } catch (e) { /* 저장을 못 하는 환경이면 이번 화면에서만 바뀐다 */ }
    setTimeout(function () { root.classList.remove("theming"); }, 450);
  }
  var first = stored(); if (first) root.setAttribute("data-theme", first);
  document.addEventListener("DOMContentLoaded", function () {
    var b = document.getElementById("theme"); if (b) b.addEventListener("click", function () { set(!isDark()); });
    paint();
  });
  if (window.matchMedia) { var mq = window.matchMedia("(prefers-color-scheme: dark)"); if (mq.addEventListener) mq.addEventListener("change", paint); }
  window.addEventListener("storage", function (e) { if (e.key === KEY) apply(stored()); });   // 다른 탭에서 바꾸면 여기도 따라 바뀐다
  window.KS_THEME = { isDark: isDark, set: set, paint: paint };
})();
