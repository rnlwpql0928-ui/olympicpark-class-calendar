/* 회원 먼저 — 달 고르기와 자료 읽기.
 * 차례: data/months.js → data/access-<달>.js → data/facts.js → (data-main 의 app.js 또는 ops.js)
 * 달: 주소 ?m=YYYY-MM 이 목록에 있으면 그 달 → 오늘의 달이 목록에 있으면 그 달 → 목록의 마지막 달.
 * 붙이는 주소의 ?v= 꼬리표는 이 파일을 부른 <script src="load.js?v=…"> 에서 읽는다(꼬리표는 html 한 곳에만).
 * 계산 부분은 node 에서도 불러 쓸 수 있다: require("./load.js").pickMonth(목록, "?m=2026-11", "2026-12").
 */
(function (root) {
  "use strict";
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function pickMonth(list, search, today) {
    list = list || []; if (!list.length) return null;
    var m = /[?&]m=(\d{4}-\d{2})(?:[&#]|$)/.exec(search || "");
    if (m && list.indexOf(m[1]) >= 0) return m[1];
    var t = String(today || "").slice(0, 7);
    if (list.indexOf(t) >= 0) return t;
    return list[list.length - 1];
  }
  function monthLabel(month, today) {   // 오늘이 자료의 달이면 「2026 · 11」, 아니면 「2026년 11월 자료」
    var y = month.slice(0, 4), mm = month.slice(5, 7);
    return String(today || "").slice(0, 7) === month ? y + " · " + mm : (+y) + "년 " + (+mm) + "월 자료";
  }
  function longName(month) { return (+month.slice(0, 4)) + "년 " + (+month.slice(5, 7)) + "월"; }
  var core = { pickMonth: pickMonth, monthLabel: monthLabel, longName: longName };
  if (typeof module !== "undefined" && module.exports) { module.exports = core; return; }
  if (typeof document === "undefined") return;

  var me = document.currentScript, V = ((me && me.src.match(/[?&]v=([0-9a-z]+)/)) || [])[1] || "";
  var MAIN = (me && me.getAttribute("data-main")) || "app.js", EMPTY = (me && me.getAttribute("data-empty")) || "이 달 자료가 아직 없어요";
  var now = new Date(), TODAY = now.getFullYear() + "-" + pad(now.getMonth() + 1);
  function base() { return location.href.split("#")[0].split("?")[0]; }
  function hrefOf(m) { return base() + "?m=" + m + location.hash; }   // 달을 바꿔도 고른 시설·강좌(해시)는 그대로
  function put(src, next) {
    var s = document.createElement("script");
    s.src = src + (V ? "?v=" + V : "");
    s.onload = next; s.onerror = function () { fail(); };
    document.body.appendChild(s);
  }
  // 머리의 달 표시: 달이 둘 이상이면 옆에 달 단추(누르면 ?m= 로 옮겨 감)
  function mount(tag) {
    if (!tag) return; tag.textContent = monthLabel(L.month, TODAY);
    if (L.months.length < 2 || !tag.parentNode) return;
    var box = document.createElement("span"); box.className = "months"; box.setAttribute("role", "group"); box.setAttribute("aria-label", "달 고르기");
    L.months.forEach(function (m) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = (+m.slice(5, 7)) + "월"; b.title = longName(m);
      b.setAttribute("aria-pressed", String(m === L.month));
      b.onclick = function () { if (m !== L.month) location.href = hrefOf(m); };
      box.appendChild(b);
    });
    tag.parentNode.insertBefore(box, tag.nextSibling);
  }
  var L = root.MB_LOAD = { V: V, today: TODAY, month: null, months: [], hrefOf: hrefOf, label: monthLabel, longName: longName, mount: mount };
  var failed = false;
  function fail() {   // 달 파일을 못 읽으면 빈 화면 대신 알림과 읽을 수 있는 달
    if (failed) return; failed = true;
    var main = document.querySelector("main"); if (main) main.style.display = "none";   // .split·.opsmain 의 display 가 hidden 을 덮으므로 직접 숨긴다
    var box = document.createElement("div"); box.className = "nodata"; box.setAttribute("role", "alert");
    var h = document.createElement("p"); h.className = "nodata-m"; h.textContent = L.month ? longName(L.month) : "회원 먼저"; box.appendChild(h);
    var p = document.createElement("p"); p.textContent = EMPTY; box.appendChild(p);
    var ok = L.months.filter(function (m) { return m !== L.month; });
    if (ok.length) {
      var q = document.createElement("p");
      ok.forEach(function (m) { var a = document.createElement("a"); a.className = "btn"; a.href = hrefOf(m); a.textContent = longName(m) + " 자료 보기"; q.appendChild(a); });
      box.appendChild(q);
    }
    document.body.insertBefore(box, document.body.firstChild);
  }
  put("data/months.js", function () {
    L.months = (root.MB_MONTHS || []).slice();
    L.month = pickMonth(L.months, location.search, TODAY);
    if (!L.month) { fail(); return; }
    put("data/access-" + L.month + ".js", function () {
      if (!root.MB_DATA || root.MB_DATA.month !== L.month) { fail(); return; }
      put("data/facts.js", function () { put(MAIN, function () {}); });
    });
  });
})(typeof window !== "undefined" ? window : this);
