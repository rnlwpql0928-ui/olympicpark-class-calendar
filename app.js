/* 회원 먼저 — 회원 화면 동작.
 * 숫자는 모두 data/*.js 에서 읽어 센다(여기에 회차·정원·배수를 적지 않는다).
 * days 값: 1 오는 길×입장 몰림 · 2 가는 길×퇴장 몰림 · 4 가는 길×입장 몰림(나가는 길에 들어오는 차) · 0 그날 수업은 있으나 안 겹침.
 * 주소: ?m=달#/시설/강좌번호/날짜  (예: ?m=2026-11#/pool/1004208/13) · 달은 load.js 가 고른다.
 * 계산 부분(core)은 node 에서도 불러 쓸 수 있다: require("./app.js").tally(MB_DATA, 시설).
 */
(function (root) {
  "use strict";
  // ---------- 계산 (화면 없이도 돈다) ----------
  var WHEN = { 1: "올 때 겹치는 날", 2: "갈 때 겹치는 날", 4: "나가는 길에 마주치는 날" };
  function listed(c) { for (var k in c.days) if (c.days[k] & 7) return true; return false; }   // 기본 목록: 겹침(1·2) 또는 마주침만(4)
  function bitsOf(c) { var b = 0; for (var k in c.days) b |= c.days[k]; return b & 7; }        // 그 강좌가 공연 날에 가진 겹침 종류의 합집합
  function todoFor(todo, bits) {   // 할 일마다 when(겹침 종류) 가운데 bits 와 겹치는 것만 꼬리표로 남긴다
    var out = [];
    todo.forEach(function (t) { var w = (t.when || [1, 2, 4]).filter(function (b) { return (bits & b) !== 0; }); if (w.length) out.push({ t: t, tags: w }); });
    return out;
  }
  var core = { tally: tally, listed: listed, bitsOf: bitsOf, todoFor: todoFor, WHEN: WHEN };
  if (typeof module !== "undefined" && module.exports) { module.exports = core; return; }
  root.MB_MEMBER = core;

  var D = root.MB_DATA, G = root.MB_GUIDE, F = root.MB_FACTS;
  var SVGNS = "http://www.w3.org/2000/svg";
  var $ = function (id) { return document.getElementById(id); };
  var S = { fac: D.facilities[0], cls: null, day: null, q: "", band: "all", only: true };   // 처음에는 공연과 겹치는 강좌만 보여 준다(찾기를 쓰면 전체에서 찾는다)
  var BANDS = [["all", "전체", 0, 1440], ["am", "아침 (~12시)", 0, 720], ["pm", "낮 (12~17시)", 720, 1020], ["eve", "저녁 (17시~)", 1020, 1440]];
  var MM = +D.month.slice(5, 7), YY = +D.month.slice(0, 4);
  var REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function svg(tag, attrs) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function num(n) { return new Intl.NumberFormat("ko-KR").format(n); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toMin(hm) { var p = hm.split(":"); return (+p[0]) * 60 + (+p[1]); }
  function clock(m) { return pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60); }
  function span(c) { var p = c.time.split("~"); return [toMin(p[0]), toMin(p[1])]; }
  function dd(show) { return show.date.slice(8); }
  function md(show) { return MM + "." + (+dd(show)); }
  function prim(code) { return (code & 3) !== 0; }
  function secOnly(code) { return (code & 4) !== 0 && (code & 3) === 0; }
  function slugOf(f) { return G.fac[f.name].slug; }
  function showBy(day) { for (var i = 0; i < D.shows.length; i++) if (dd(D.shows[i]) === day) return D.shows[i]; return null; }

  // ---------- 세기 ----------
  // cap = 회차마다 정원을 더한 값(같은 강좌가 공연 날마다 다시 더해진다) · classCap = 겹치는 강좌마다 정원을 한 번만 더한 값(달 합계에 쓴다)
  function tally(D, f) {
    var t = { classes: {}, sessions: 0, cap: 0, classCap: 0, sec: 0, listed: 0, byDay: {} };
    D.shows.forEach(function (s) { t.byDay[dd(s)] = { n: 0, cap: 0, sec: 0, starts: {}, secStarts: {} }; });
    f.classes.forEach(function (c) {
      var hit = false;
      for (var day in c.days) {
        var code = c.days[day], b = t.byDay[day], st = span(c)[0];
        if (!b) continue;
        if (prim(code)) { hit = true; t.classes[c.id] = 1; t.sessions++; t.cap += c.cap; b.n++; b.cap += c.cap; b.starts[st] = (b.starts[st] || 0) + 1; }
        else if (secOnly(code)) { t.sec++; b.sec++; b.secStarts[st] = (b.secStarts[st] || 0) + 1; }
      }
      if (hit) t.classCap += c.cap;
      if (listed(c)) t.listed++;
    });
    t.nClasses = Object.keys(t.classes).length;
    return t;
  }
  var TALLY = {}; D.facilities.forEach(function (f) { TALLY[f.name] = tally(D, f); });
  function hitDays(c) { var a = []; D.shows.forEach(function (s) { var code = c.days[dd(s)]; if (code) a.push({ show: s, code: code }); }); return a; }
  function primCount(c) { var n = 0; for (var k in c.days) if (prim(c.days[k])) n++; return n; }
  function secCount(c) { var n = 0; for (var k in c.days) if (secOnly(c.days[k])) n++; return n; }

  // ---------- 주소 ----------
  function buildHash(st) { return "#/" + slugOf(st.fac) + (st.cls ? "/" + st.cls.id + (st.day ? "/" + st.day : "") : (st.day ? "/-/" + st.day : "")); }
  function parse() {
    var h = location.hash.replace(/^#\/?/, "").split("/");
    var fac = D.facilities[0]; D.facilities.forEach(function (f) { if (slugOf(f) === h[0]) fac = f; });
    var cls = null; fac.classes.forEach(function (c) { if (c.id === h[1]) cls = c; });
    S.fac = fac; S.cls = cls; S.day = h[2] && showBy(h[2]) ? h[2] : null;
  }
  function go(patch) {
    var n = { fac: S.fac, cls: S.cls, day: S.day }; for (var k in patch) n[k] = patch[k];
    var h = buildHash(n); if (location.hash === h) render(); else location.hash = h;
  }

  // ---------- 움직임: 세어 올리기·떠오르기·물결 ----------
  function countUp(node, target, suffix) {
    if (REDUCED || !target) { node.textContent = num(target) + suffix; return; }
    var t0 = null, dur = 800;
    function step(ts) { if (t0 == null) t0 = ts; var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 3); node.textContent = num(Math.round(target * e)) + suffix; if (p < 1) requestAnimationFrame(step); }
    node.textContent = "0" + suffix; requestAnimationFrame(step);
  }
  var IO = "IntersectionObserver" in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); if (e.target._onIn) { e.target._onIn(); e.target._onIn = null; } IO.unobserve(e.target); } }); }, { rootMargin: "0px 0px -6% 0px" }) : null;
  function watch(node, onIn) { node.classList.add("rv"); node._onIn = onIn || null; if (IO) IO.observe(node); else { node.classList.add("in"); if (onIn) onIn(); } }
  function initWater() {
    var pool = $("pool"), w = $("wave"), d = "M-100 12";
    for (var i = 0; i < 30; i++) d += " q 25 -11 50 0 t 50 0";
    w.appendChild(svg("path", { d: d }));
    pool.addEventListener("click", function (ev) {   // 파란 면을 누르면 물결이 번진다
      if (REDUCED) return; var r = pool.getBoundingClientRect(), s = el("span", "ripple"); s.style.left = (ev.clientX - r.left) + "px"; s.style.top = (ev.clientY - r.top) + "px";
      pool.appendChild(s); setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 950);
    });
  }

  // ---------- 왼쪽: 레인 ----------
  var X0 = 104, X1 = 986, T0 = 360, T1 = 1440, TOP = 34, LH = 45, LANEKEY = null;
  function x(m) { return X0 + (Math.max(T0, Math.min(T1, m)) - T0) / (T1 - T0) * (X1 - X0); }
  function renderLanes() {
    var g = $("lanes"), r = D.rule, t = TALLY[S.fac.name]; g.textContent = "";
    var key = slugOf(S.fac) + "|" + (S.cls ? S.cls.id : ""); g.classList.toggle("fresh", key !== LANEKEY); LANEKEY = key;   // 시설·강좌가 바뀔 때만 점이 다시 떠오른다
    for (var h = 6; h <= 24; h += 3) {
      g.appendChild(svg("line", { x1: x(h * 60), x2: x(h * 60), y1: TOP, y2: TOP + LH * D.shows.length, class: "grid" }));
      var tx = svg("text", { x: x(h * 60), y: 20, class: "ax" }); tx.textContent = pad(h); g.appendChild(tx);
    }
    D.shows.forEach(function (s, i) {
      var day = dd(s), y0 = TOP + i * LH, mid = y0 + LH / 2, st = toMin(s.start), b = t.byDay[day];
      var code = S.cls ? S.cls.days[day] : undefined, lane = svg("g", { class: "lane" + (S.cls && code === undefined ? " off" : "") + (S.day === day ? " sel" : "") });
      lane.style.setProperty("--i", i);
      lane.appendChild(svg("rect", { x: 0, y: y0, width: 1000, height: LH, class: "hitbox" }));
      lane.appendChild(svg("line", { x1: X0, x2: X1, y1: y0, y2: y0, class: "rope" }));
      var d1 = svg("text", { x: 6, y: y0 + 30, class: "day" }); d1.textContent = +day; lane.appendChild(d1);
      var d2 = svg("text", { x: 46, y: y0 + 29, class: "dow" }); d2.textContent = s.dow; lane.appendChild(d2);
      lane.appendChild(svg("rect", { x: x(st - r.entry), y: y0 + 8, width: x(st) - x(st - r.entry), height: LH - 16, class: "band" }));
      lane.appendChild(svg("rect", { x: x(st + r.exit0), y: y0 + 8, width: x(st + r.exit1) - x(st + r.exit0), height: LH - 16, class: "band" }));
      lane.appendChild(svg("line", { x1: x(st), x2: x(st), y1: y0 + 5, y2: y0 + LH - 5, class: "start" }));
      var t2 = svg("text", { x: x(st) + 6, y: y0 + 17, class: "st" }); t2.textContent = s.start; lane.appendChild(t2);
      if (!S.cls) {
        Object.keys(b.secStarts).forEach(function (m) { lane.appendChild(svg("circle", { cx: x(+m), cy: mid, r: (2.5 + Math.sqrt(b.secStarts[m]) * 1.7).toFixed(1), class: "agg2" })); });
        Object.keys(b.starts).forEach(function (m) { lane.appendChild(svg("circle", { cx: x(+m), cy: mid, r: (2.5 + Math.sqrt(b.starts[m]) * 1.7).toFixed(1), class: "agg" })); });
        if (b.n) { var tt = svg("text", { x: 998, y: y0 + 30, class: "tot" }); tt.textContent = b.n; lane.appendChild(tt); }
      } else if (code !== undefined) {
        var sp = span(S.cls);
        lane.appendChild(svg("line", { x1: x(sp[0] - r.arrive), x2: x(sp[0]), y1: mid, y2: mid, class: "wh" + (code & 1 ? " hit" : "") }));
        lane.appendChild(svg("line", { x1: x(sp[1]), x2: x(sp[1] + r.leave), y1: mid, y2: mid, class: "wh" + (code & 6 ? " hit" : "") }));
        lane.appendChild(svg("rect", { x: x(sp[0]), y: mid - 8, width: Math.max(6, x(sp[1]) - x(sp[0])), height: 16, rx: 8, class: "cls" + (prim(code) ? " hit" : secOnly(code) ? " meet" : "") }));
      }
      var ti = svg("title", {}); ti.textContent = md(s) + " " + s.dow + " · " + s.title + " " + s.start; lane.appendChild(ti);
      lane.addEventListener("click", function () { go({ day: S.day === day ? null : day }); jump(day); });
      g.appendChild(lane);
    });
    g.appendChild(svg("line", { x1: X0, x2: X1, y1: TOP + LH * D.shows.length, y2: TOP + LH * D.shows.length, class: "rope" }));
    g.setAttribute("aria-label", MM + "월 공연 날 " + D.shows.length + "일의 차가 몰리는 시간과 " + G.fac[S.fac.name].short + " 수업");
    var le = $("lede"); le.textContent = "";
    if (S.cls) { le.appendChild(el("b", null, S.cls.time + " " + S.cls.name)); le.appendChild(document.createTextNode(" — 노란 날이 겹치는 날이에요.")); }
    var lg = $("lg"); lg.textContent = "";
    (S.cls ? [["c", "내 수업"], ["w", "오가는 " + r.arrive + "분"], ["d", "겹침"], ["b", "차가 몰리는 시간"]]
      : [["b", "차가 몰리는 시간"], ["d", "공연과 겹치는 수업"], ["o", "나가는 길에 마주치는 수업"], ["n", "그날 겹치는 수업 수"]])
      .forEach(function (a) { var sp2 = el("span"); sp2.appendChild(el("i", a[0], a[0] === "n" ? "12" : null)); sp2.appendChild(document.createTextNode(a[1])); lg.appendChild(sp2); });
  }
  function renderMonth() {   // 머리의 달 표시와 달 단추는 load.js 가 그린다(없으면 달 이름만)
    var LD = root.MB_LOAD; if (LD && LD.month === D.month) LD.mount($("monthtag")); else $("monthtag").textContent = YY + " · " + pad(MM);
  }
  function shareUrl() { return location.href.split("#")[0].split("?")[0] + "?m=" + D.month + location.hash; }   // 공유·달력 파일 주소에는 늘 그 달을 싣는다

  // ---------- 01 시설 · 02 강좌 ----------
  function renderFacs() {
    var box = $("facs"); box.textContent = "";
    D.facilities.forEach(function (f) {
      var t = TALLY[f.name], b = el("button", null, f.name); b.type = "button"; b.setAttribute("aria-pressed", String(f === S.fac));
      b.appendChild(el("small", null, MM + "월 겹치는 수업 " + num(t.sessions) + "회 · 강좌 " + num(t.nClasses) + "개"));
      b.onclick = function () { S.q = ""; $("q").value = ""; go({ fac: f, cls: null, day: null }); }; box.appendChild(b);
    });
  }
  function renderClasses() {
    var bands = $("bands"); bands.textContent = "";
    BANDS.forEach(function (bd) { var b = el("button", null, bd[1]); b.type = "button"; b.setAttribute("aria-pressed", String(S.band === bd[0])); b.onclick = function () { S.band = bd[0]; renderClasses(); }; bands.appendChild(b); });
    var t = TALLY[S.fac.name], ob = el("button", null, "겹치거나 마주치는 강좌만 (" + t.listed + ")"); ob.type = "button"; ob.setAttribute("aria-pressed", String(S.only)); ob.onclick = function () { S.only = !S.only; renderClasses(); }; bands.appendChild(ob);
    var band = BANDS.filter(function (b) { return b[0] === S.band; })[0], q = S.q.trim().toLowerCase(), ul = $("classes"), shown = 0; ul.textContent = "";
    S.fac.classes.forEach(function (c) {
      var st = span(c)[0], pc = primCount(c), sc = secCount(c);
      if (st < band[2] || st >= band[3]) return;
      if (S.only && !q && !pc && !sc && S.cls !== c) return;   // 기본 목록 = 겹치는 강좌 + 나가는 길에만 마주치는 강좌
      if (q && (c.name + " " + c.kind + " " + c.time + " " + c.group).toLowerCase().indexOf(q) < 0) return;
      shown++;
      var li = el("li"), b = el("button"); b.type = "button"; b.setAttribute("aria-pressed", String(S.cls === c));
      b.appendChild(el("span", "t", c.time));
      var n = el("span", "n");
      if (!pc && sc) { var mk = el("i", "mk"); mk.title = "나가는 길에만 마주치는 강좌"; n.appendChild(mk); }   // 줄무늬 = 마주침만(달력의 줄무늬와 같은 뜻)
      n.appendChild(document.createTextNode(c.name)); if (c.group) n.appendChild(el("small", null, c.group)); b.appendChild(n);
      b.appendChild(el("span", "h" + (pc ? "" : sc ? " m" : " z"), pc ? pc + "회" : sc ? "마주침 " + sc + "회" : "—"));
      b.onclick = function () { go({ cls: S.cls === c ? null : c, day: null }); };
      li.appendChild(b); ul.appendChild(li);
    });
    if (!shown) ul.appendChild(el("li", "none", "맞는 강좌가 없어요. 검색어나 시간대를 바꿔 보세요."));
    // 고른 강좌가 목록 안에서 보이게 맞춘다(강좌가 바뀔 때만)
    var cur = ul.querySelector('button[aria-pressed="true"]'), lk = slugOf(S.fac) + "|" + (S.cls ? S.cls.id : "");
    if (cur && lk !== LISTKEY) ul.scrollTop += cur.getBoundingClientRect().top - ul.getBoundingClientRect().top - 44;
    LISTKEY = lk;
    $("classnote").textContent = S.only && !q
      ? "공연과 겹치거나 나가는 길에 마주치는 강좌 " + shown + "개 먼저 · 줄무늬 = 마주치기만 하는 강좌 · 안 보이면 이름으로 찾아보세요(전체 " + S.fac.classes.length + "개)"
      : "공연 날 수업이 있는 강좌 " + S.fac.classes.length + "개 가운데 " + shown + "개 · 숫자 = 공연과 겹치는 횟수";
  }

  // ---------- 큰 답 ----------
  var SAYKEY = null, LISTKEY = null;
  function renderAnswer() {
    var who = $("who"), say = $("say"), sub = $("saysub"), t = TALLY[S.fac.name], mark = null;
    function put(parts) { say.textContent = ""; parts.forEach(function (p) { if (p === "\n") say.appendChild(el("br")); else if (p.n != null) { mark = el("mark", null, num(p.n) + p.unit); mark._n = p.n; mark._u = p.unit; say.appendChild(mark); } else say.appendChild(document.createTextNode(p)); }); }
    function dates(a) { return a.map(function (h) { return md(h.show) + " " + h.show.dow; }).join(" · "); }
    if (!S.cls) {
      who.textContent = S.fac.name + " · " + YY + "년 " + MM + "월 · 강좌 " + num(t.nClasses) + "개";
      put(["수업 ", { n: t.sessions, unit: "회" }, "가", "\n", "공연과 겹쳐요!"]);
      sub.textContent = "강좌를 누르면 내 수업만 볼 수 있어요!";
    } else {
      var H = hitDays(S.cls), P = H.filter(function (h) { return prim(h.code); }), Q = H.filter(function (h) { return secOnly(h.code); });
      who.textContent = S.cls.time + " · " + S.cls.name + (S.cls.group ? " · " + S.cls.group : "");
      if (P.length) {
        var a = P.some(function (h) { return h.code & 1; }), l = P.some(function (h) { return h.code & 2; });
        put([{ n: P.length, unit: "일" }, ",", "\n", (a && l ? "올 때도 갈 때도" : a ? "올 때" : "갈 때") + " 겹쳐요!"]);
        sub.textContent = dates(P) + (Q.length ? " · 나가는 길에 들어오는 차와 마주치는 날 " + dates(Q) : "");
      } else if (Q.length) {
        put([{ n: Q.length, unit: "일" }, ",", "\n", "나가는 길에", "\n", "들어오는 차와 마주쳐요."]);
        sub.textContent = dates(Q);
      } else {
        put([MM + "월에는", "\n", "안 겹쳐요."]);
        sub.textContent = "공연 날 수업 " + Object.keys(S.cls.days).length + "일 모두 차가 몰리는 시간 밖이에요.";
      }
    }
    var key = slugOf(S.fac) + "|" + (S.cls ? S.cls.id : "");
    if (key !== SAYKEY) {
      SAYKEY = key; $("live").textContent = say.innerText.replace(/\n/g, " ") + " " + sub.textContent;   // 화면 읽기 프로그램에는 답이 바뀔 때 한 번만(세어 올리는 숫자는 읽지 않는다)
      say.classList.remove("pop"); void say.offsetWidth; say.classList.add("pop"); if (mark) countUp(mark, mark._n, mark._u);
    }
  }

  // ---------- 03 달력 ----------
  function sentences(c, show, code) {
    var r = D.rule, sp = span(c), st = toMin(show.start), out = [];
    var come = clock(sp[0] - r.arrive) + "~" + clock(sp[0]), leave = clock(sp[1]) + "~" + clock(sp[1] + r.leave), inRush = clock(st - r.entry) + "~" + clock(st), outRush = clock(st + r.exit0) + "~" + clock(st + r.exit1);
    if (code & 1) out.push(["올 때", "오는 시간 " + come + "이 공연 보러 오는 차가 몰리는 " + inRush + "과 겹쳐요."]);
    if (code & 2) out.push(["갈 때", "가는 시간 " + leave + "이 공연 끝나고 차가 빠지는 " + outRush + "과 겹쳐요."]);
    if (code & 4) out.push(["갈 때", "가는 시간 " + leave + "이 공연 보러 오는 차가 몰리는 " + inRush + "과 겹쳐요. 나가는 길에 들어오는 차와 마주쳐요."]);
    return out;
  }
  function jump(day) { setTimeout(function () { var c = document.querySelector('.dcard[data-day="' + day + '"]'); if (c && S.day === day) c.scrollIntoView({ block: "nearest", behavior: REDUCED ? "auto" : "smooth" }); }, 30); }
  function renderCal() {
    var cal = $("cal"), t = TALLY[S.fac.name]; cal.textContent = "";
    ["월", "화", "수", "목", "금", "토", "일"].forEach(function (w) { cal.appendChild(el("div", "hd", w)); });
    var first = new Date(Date.UTC(YY, MM - 1, 1)), lead = (first.getUTCDay() + 6) % 7, last = new Date(Date.UTC(YY, MM, 0)).getUTCDate();
    for (var k = 0; k < lead; k++) cal.appendChild(el("div", "c blank"));
    for (var d = 1; d <= last; d++) (function (d) {
      var day = pad(d), s = showBy(day);
      if (!s) { cal.appendChild(el("div", "c", String(d))); return; }
      var code = S.cls ? S.cls.days[day] : undefined, b = t.byDay[day];
      var cls = "c show" + (S.cls ? (code !== undefined && prim(code) ? " hit" : code !== undefined && secOnly(code) ? " meet" : "") : "") + (S.day === day ? " sel" : "");
      var c = el("button", cls, String(d)); c.type = "button";
      c.appendChild(el("small", null, S.cls ? (code === undefined ? s.start + " 공연" : prim(code) ? "겹침" : secOnly(code) ? "마주침" : "안 겹침") : (b.n ? b.n + "회" : s.start + " 공연")));
      c.title = s.title + " " + s.start; c.onclick = function () { go({ day: S.day === day ? null : day }); jump(day); };
      cal.appendChild(c);
    })(d);
    var lg = el("div", "callg");
    (S.cls ? [["s", "공연 날"], ["h", "올 때나 갈 때 겹치는 날"], ["m", "나가는 길에 마주치는 날"]] : [["s", "공연 날 · 숫자 = 그날 겹치는 수업 수"]]).forEach(function (a) { var sp = el("span"); sp.appendChild(el("i", a[0])); sp.appendChild(document.createTextNode(a[1])); lg.appendChild(sp); });
    cal.appendChild(lg);
    var box = $("days"); box.textContent = "";
    function card(s, fillBody) {
      var day = dd(s), c = el("div", "dcard" + (S.day === day ? " sel" : "")); c.dataset.day = day;
      var dt = el("div", "dt", md(s)); dt.appendChild(el("small", null, s.dow + "요일")); c.appendChild(dt);
      var body = el("div"); body.appendChild(el("h3", null, s.title + " · " + s.start + " 시작")); fillBody(body); c.appendChild(body); box.appendChild(c);
    }
    if (S.cls) {
      var H = hitDays(S.cls);
      H.forEach(function (h) { card(h.show, function (body) { sentences(S.cls, h.show, h.code).forEach(function (x) { var p = el("p"); p.appendChild(el("b", null, x[0])); p.appendChild(document.createTextNode(" " + x[1])); body.appendChild(p); }); }); });
      if (!H.length) box.appendChild(el("p", "fine", MM + "월 공연 날에는 겹치는 수업이 없어요."));
    } else D.shows.forEach(function (s) {
      var b = t.byDay[dd(s)];
      card(s, function (body) { body.appendChild(el("p", "cnt", b.n ? "겹치는 수업 " + b.n + "회 · 정원 합 " + num(b.cap) + "명(상한)" + (b.sec ? " · 나가는 길에 마주치는 수업 " + b.sec + "회" : "") : (b.sec ? "나가는 길에 마주치는 수업 " + b.sec + "회" : "겹치는 수업 없음"))); });
    });
  }

  // ---------- 04 할 일 ----------
  function myTodo() { return todoFor(G.todo, S.cls ? bitsOf(S.cls) : 7); }   // 고른 강좌가 공연 날에 가진 겹침 종류에 맞는 할 일만(강좌를 안 골랐으면 셋 다)
  function renderTodo() {
    var ol = $("todo"); ol.textContent = "";
    var list = myTodo();
    if (!list.length) ol.appendChild(el("li", "none", "내 수업은 " + MM + "월 공연 날과 겹치지 않아서 따로 할 일이 없어요."));
    list.forEach(function (x) {
      var t = x.t;
      var li = el("li"); li.appendChild(el("h3", null, t.head));
      var wh = el("p", "when"); x.tags.forEach(function (b) { wh.appendChild(el("span", null, WHEN[b])); }); li.appendChild(wh);   // 어느 때 할 일인지
      li.appendChild(el("blockquote", null, "「" + t.quote + "」"));
      var s = el("p", "s"); var a = el("a", "lnk", t.src + " ↗"); a.href = t.url; a.target = "_blank"; a.rel = "noopener"; s.appendChild(a); li.appendChild(s);
      var m = t.more && t.more[S.fac.name]; if (m) { li.appendChild(el("p", "more", m.text)); li.appendChild(el("p", "s", m.src)); }
      ol.appendChild(li);
    });
    var can = !!S.cls && hitDays(S.cls).length > 0; $("b-ics").disabled = !can;
    $("icsnote").textContent = can ? "겹치는 날마다 수업 시간에 일정을 넣고 하루 전에 알려 드려요. 주최 안내 문구와 출처도 함께 들어가요." : "내 강좌를 고르면, 겹치는 날을 달력 파일로 받을 수 있어요.";
  }
  function icsEsc(v) { return String(v).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  function icsFold(line) {
    var out = "", cur = "", bytes = 0;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i], code = line.charCodeAt(i), b = code < 0x80 ? 1 : code < 0x800 ? 2 : (code >= 0xD800 && code <= 0xDBFF) ? 4 : 3;
      if (b === 4) ch += line[++i];
      if (bytes + b > 73) { out += cur + "\r\n "; cur = ""; bytes = 1; }
      cur += ch; bytes += b;
    }
    return out + cur;
  }
  function stamp(d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
  function saveIcs() {
    if (!S.cls) return; var H = hitDays(S.cls); if (!H.length) return;
    var c = S.cls, sp = span(c), L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//members-first//olympic-park//KO", "CALSCALE:GREGORIAN"];
    var todo = myTodo().map(function (x) { var t = x.t; return t.head + " [" + x.tags.map(function (b) { return WHEN[b]; }).join(" · ") + "]: 「" + t.quote + "」 (" + t.src + ")"; }).join("\n");
    H.forEach(function (h) {
      var day = +dd(h.show), st = new Date(Date.UTC(YY, MM - 1, day, 0, sp[0]) - 9 * 3600000), en = new Date(Date.UTC(YY, MM - 1, day, 0, sp[1]) - 9 * 3600000);
      var why = sentences(c, h.show, h.code).map(function (x) { return x[0] + " — " + x[1]; }).join("\n");
      L.push("BEGIN:VEVENT", "UID:" + slugOf(S.fac) + "-" + c.id + "-" + dd(h.show) + "@members-first", "DTSTAMP:" + stamp(new Date()), "DTSTART:" + stamp(st), "DTEND:" + stamp(en),
        "SUMMARY:" + icsEsc("[공연 날] " + c.name), "LOCATION:" + icsEsc(S.fac.name),
        "DESCRIPTION:" + icsEsc(h.show.title + " " + h.show.start + " 시작\n" + why + "\n\n" + todo + "\n" + shareUrl()),
        "BEGIN:VALARM", "TRIGGER:-" + G.alarmBefore, "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc("내일 공연 날 — " + c.name), "END:VALARM", "END:VEVENT");
    });
    L.push("END:VCALENDAR");
    var blob = new Blob([L.map(icsFold).join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" }), a = el("a");
    a.href = URL.createObjectURL(blob); a.download = "members-first-" + slugOf(S.fac) + "-" + c.id + ".ics"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function copyLink() {
    var btn = $("b-copy"), txt = shareUrl(), done = function () { var o = btn.textContent; btn.textContent = "복사했어요"; setTimeout(function () { btn.textContent = o; }, 1400); };
    function fallback() { var ta = el("textarea"); ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { /* 복사 권한이 없으면 그대로 둔다 */ } document.body.removeChild(ta); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
  }

  // ---------- 05 왜 ----------
  function median(a) { var b = a.slice().sort(function (p, q) { return p - q; }), n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; }
  function renderStats() {
    var box = $("stats"), t = TALLY[S.fac.name], fr = F.friday, p4 = F.p4, pool = G.fac["올림픽수영장"], r = D.rule; box.textContent = "";
    function tile(v, text, link) { var d = el("div"); d.appendChild(el("b", null, v)); var sp = el("span", null, text); if (link) { sp.appendChild(document.createTextNode(" ")); var a = el("a", "lnk", link[0] + " ↗"); a.href = link[1]; a.target = "_blank"; a.rel = "noopener"; sp.appendChild(a); } d.appendChild(sp); box.appendChild(d); }
    tile(G.voc.n + "건", "공연·행사 날 주차가 불편했다는 회원 글. " + G.voc.label + ", " + G.voc.from + " ~ " + G.voc.to + ".", ["그중 한 글과 주최 답변", G.voc.url]);
    tile(p4.eventFull + " / " + p4.eventDays + "일", "공원에 행사가 있던 날, 수영장 옆 " + pool.near + "(" + pool.nearCap + "대)가 만차로 적힌 날. 행사 없던 날은 " + p4.quietFull + " / " + p4.quietDays + "일. 직원 기록 " + p4.from + " ~ " + p4.to + ".");
    var usual = median(fr.usual.map(function (u) { return u.entries; }));
    tile((fr.show.entries / usual).toFixed(1) + "배", "공연 금요일 " + fr.show.window + "에 들어온 차 " + num(fr.show.entries) + "대. 평소 금요일은 " + num(usual) + "대(세 번의 가운데 값). 그 차의 " + fr.show.lt10pct + "%는 10분 안에 나감.");
    tile(num(t.sessions) + "회", MM + "월 " + S.fac.name + " 수업 가운데 공연과 겹치는 횟수. 강좌 " + num(t.nClasses) + "개 · 강좌 정원 합 " + num(t.classCap) + "명(상한).");
    // 접어 둔 뜻풀이: 무엇을 「겹친다」고 세었는지, 그리고 그 말이 뜻하지 않는 것
    var rule = $("rule"); rule.textContent = "";
    rule.appendChild(el("p", null, "수업 시작 " + r.arrive + "분 전~시작이 공연 시작 " + r.entry + "분 전~시작과 만나거나, 수업 끝~" + r.leave + "분 뒤가 공연 시작 " + r.exit0 + "~" + r.exit1 + "분 뒤와 만나는 수업이에요."));
    var ul = el("ul", "nots");
    ["겹침 = 오가는 시간이 차 몰리는 시간과 만남. 수업 취소나 주차 불가를 뜻하지 않음",
      "수업 앞 " + r.arrive + "분·뒤 " + r.leave + "분 = 가정. 실제 도착·출발 시각을 뜻하지 않음",
      "강좌 정원 합 = 겹치는 강좌마다 정원을 한 번씩 더한 상한. 실제 온 사람 수를 뜻하지 않음"].forEach(function (line) { ul.appendChild(el("li", null, line)); });
    rule.appendChild(ul);
    var src = $("src"); src.textContent = "";
    G.src.forEach(function (line) { src.appendChild(el("li", null, line)); });
    src.appendChild(el("li", null, "주최 안내 열람일 " + G.seen + " · 계산한 때 " + D.made));
  }

  // ---------- 사진과 글자 그림 ----------
  // 기본은 사진이다. 누르면 같은 사진을 글자 열넷으로 다시 그린다(아주 밝은 지붕·분수는 노란 겹에 따로 찍고, 위에서부터 찍혀 내려온 뒤 물이 반짝이듯 깜빡인다). 다시 누르면 사진.
  var RAMP = " .,:;-=+*xX%#@", SHOT = null;
  function charRatio(pre) {
    var s = el("span", null, "MMMMMMMMMM"); s.style.cssText = "position:absolute;visibility:hidden;font-size:100px;line-height:1;white-space:pre"; pre.appendChild(s);
    var r = s.getBoundingClientRect().width / 1000; pre.removeChild(s); return r > 0.3 && r < 0.9 ? r : 0.6;
  }
  function fitAscii() { var w = $("shotbox").clientWidth; if (SHOT && w > 0) $("shotbox").style.fontSize = (w / (SHOT.cols * SHOT.ratio)).toFixed(3) + "px"; }
  function asciiFrame(upto, tw) {
    var o1 = [], o2 = [], n = RAMP.length, r, k;
    for (r = 0; r < SHOT.rows; r++) {
      var l1 = "", l2 = "";
      if (r < upto) for (k = 0; k < SHOT.cols; k++) {
        var i = r * SHOT.cols + k, v = SHOT.L[i]; if (tw && tw[i]) v = Math.min(1, v + tw[i]);
        var ch = RAMP[Math.min(n - 1, Math.floor(v * n))];
        if (v >= G.photo.hotFrom) { l1 += " "; l2 += ch; } else { l1 += ch; l2 += " "; }
      }
      o1.push(l1); o2.push(l2);
    }
    $("ascii").textContent = o1.join("\n"); $("ascii2").textContent = o2.join("\n");
  }
  function playAscii() {
    var run = ++SHOT.run; SHOT.settled = false;
    if (REDUCED) { asciiFrame(SHOT.rows); return; }
    var t0 = null; asciiFrame(0);
    function step(ts) { if (run !== SHOT.run) return; if (t0 == null) t0 = ts; var p = Math.min(1, (ts - t0) / 1100); asciiFrame(Math.ceil(SHOT.rows * p)); if (p < 1) requestAnimationFrame(step); else SHOT.settled = true; }
    requestAnimationFrame(step);
  }
  function twinkle() {   // 글자 그림이 다 그려진 동안에만 밝은 칸 몇 개가 깜빡인다(한 번만 건다)
    setInterval(function () {
      var fig = $("shot"), r = fig.getBoundingClientRect(); if (!SHOT || !SHOT.settled || document.hidden || r.bottom < 0 || r.top > window.innerHeight || !fig.classList.contains("ascii")) return;
      var tw = {}, k; for (k = 0; k < SHOT.lit.length / 14; k++) tw[SHOT.lit[Math.floor(Math.random() * SHOT.lit.length)]] = 0.22;
      asciiFrame(SHOT.rows, tw);
    }, 170);
  }
  function shotLabels() {
    var P = G.photo, on = $("shot").classList.contains("ascii"), box = $("shotbox");
    $("shothint").textContent = on ? P.toPhoto : P.toAscii;
    $("shotcap").textContent = P.cap + " — " + (on ? P.asciiNote : P.cropNote) + " · ";
    $("shotreal").alt = P.cap; box.setAttribute("aria-label", on ? P.toPhoto : P.toAscii); box.setAttribute("aria-pressed", String(on));
  }
  function initPhoto() {
    var P = G.photo, fig = $("shot"), box = $("shotbox"), real = $("shotreal"), img = new Image();
    var cr = $("shotcredit"); cr.textContent = P.credit + " ↗"; cr.href = P.page; shotLabels();
    box.style.aspectRatio = P.crop.w + " / " + P.crop.h;   // 사진이 오기 전에 자리를 잡아 둔다
    img.onload = function () {
      try {
        var big = document.createElement("canvas"); big.width = P.crop.w; big.height = P.crop.h; big.getContext("2d").drawImage(img, P.crop.x, P.crop.y, P.crop.w, P.crop.h, 0, 0, P.crop.w, P.crop.h);
        real.src = big.toDataURL("image/jpeg", 0.86);
        var ratio = charRatio($("ascii")), cols = P.cols, rows = Math.round(cols * (P.crop.h / P.crop.w) * ratio), cv = document.createElement("canvas"); cv.width = cols; cv.height = rows;
        var cx = cv.getContext("2d"); cx.drawImage(img, P.crop.x, P.crop.y, P.crop.w, P.crop.h, 0, 0, cols, rows);
        var d = cx.getImageData(0, 0, cols, rows).data, L = [], lit = [], i;
        for (i = 0; i < cols * rows; i++) L.push((0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255);
        var srt = L.slice().sort(function (a, b) { return a - b; }), lo = srt[Math.floor((srt.length - 1) * P.lo)], hi = srt[Math.floor((srt.length - 1) * P.hi)];   // 사진마다 어두운 쪽·밝은 쪽을 백분위로 잘라 대비를 맞춘다
        for (i = 0; i < L.length; i++) { L[i] = Math.pow(Math.max(0, Math.min(1, (L[i] - lo) / ((hi - lo) || 1))), P.gamma); if (L[i] > 0.5) lit.push(i); }
        SHOT = { cols: cols, rows: rows, ratio: ratio, L: L, lit: lit, run: 0, settled: false };
        fig.classList.add("ok"); fitAscii(); if (!REDUCED) twinkle();
      } catch (e) { fig.classList.add("plain"); real.src = P.src; }   // 픽셀을 못 읽는 환경이면 사진만 보인다(글자 그림 단추는 숨긴다)
    };
    img.onerror = function () { fig.hidden = true; };
    img.src = P.src;
    window.addEventListener("resize", fitAscii);
    function toggle() { if (!SHOT) return; var on = fig.classList.toggle("ascii"); shotLabels(); fitAscii(); if (on) playAscii(); else { SHOT.run++; SHOT.settled = false; } }
    box.addEventListener("click", toggle);
    box.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } });
  }

  function render() {
    parse();
    $("brand").href = "#/" + slugOf(S.fac);
    renderLanes(); renderFacs(); renderClasses(); renderAnswer(); renderCal(); renderTodo(); renderStats();
  }
  $("q").addEventListener("input", function () { S.q = this.value; renderClasses(); });
  $("q").addEventListener("keydown", function (ev) {   // 엔터 = 맨 위 강좌 고르기 · Esc = 찾는 말 지우기
    if (ev.key === "Enter") { var b = document.querySelector("#classes li button"); if (b) { ev.preventDefault(); b.click(); } }
    else if (ev.key === "Escape" && this.value) { this.value = ""; S.q = ""; renderClasses(); }
  });
  $("b-ics").onclick = saveIcs; $("b-copy").onclick = copyLink;
  window.addEventListener("hashchange", render);
  window.MB_APP = { state: S, tally: TALLY, hitDays: hitDays, sentences: sentences, go: go };
  renderMonth(); render(); initWater(); initPhoto();
  watch($("shot")); watch($("row-why")); watch($("row-todo"));
})(typeof window !== "undefined" ? window : this);
