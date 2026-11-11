/* 공연 날, 내 수업은? — 운영 화면.
 * 숫자는 모두 data/*.js 에서 읽어 센다(회차·정원·시각을 여기에 적지 않는다).
 * days 값(app.js 와 같음): 1 오는 길×입장 몰림 · 2 가는 길×퇴장 몰림 · 4 가는 길×입장 몰림(마중 섞임) · 0 그날 수업은 있으나 안 겹침 · 키 없음 = 그날 수업 없음.
 * 겹치는 회차 = 1 또는 2가 든 회차. 마중 섞임 회차 = 4만 든 회차(1·2가 함께 들면 겹치는 회차로 센다).
 * 계산 부분(core)은 node 에서도 불러 쓸 수 있다: require("./ops.js").compute(MB_DATA, 시설).
 * 그림의 네모 하나 = 정원 UNIT 명(상한). 나머지는 덜 찬 네모로 그린다(6명을 꽉 찬 한 칸으로 그리지 않는다).
 * 주소: #pool · #sc
 */
(function (root) {
  "use strict";

  // ---------- 계산 (화면 없이도 돈다) ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toMin(hm) { var p = hm.split(":"); return (+p[0]) * 60 + (+p[1]); }
  function clock(m) { return pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60); }
  function span(c) { var p = c.time.split("~"); return [toMin(p[0]), toMin(p[1])]; }
  function dd(show) { return show.date.slice(8); }
  function prim(code) { return (code & 3) !== 0; }
  function secOnly(code) { return (code & 4) !== 0 && (code & 3) === 0; }
  function isKid(c) { return /어린이/.test(c.group || ""); }
  var UNKNOWN = /테니스|골프|승마/;   // 강좌 자료에 장소 칸이 없고 건물 밖 수업일 수 있는 종목
  function isUnk(c) { return UNKNOWN.test(c.kind || ""); }

  var CAND = [180, 150, 120, 90];   // 관리 시작 후보: 공연 시작 몇 분 전
  var LEAD = 240;                    // 도착 그림이 보여 주는 범위: 공연 시작 몇 분 전부터(가장 이른 후보보다 한 시간 앞)
  var UNIT = 10;                     // 네모 하나 = 정원 몇 명
  // 후보 시각 [공연 시작 − k, 공연 시작) 과 도착 구간 [수업 시작 − arrive, 수업 시작) 이 겹치는 그날 회차(반열림 — 끝점만 닿으면 안 겹침)
  // 그날 그 강좌가 도는지 = days 에 그 날짜 열쇠가 있는지 · rest = 테니스·골프·승마 제외
  function candidates(D, f, show) {
    var st = toMin(show.start), day = dd(show), a = D.rule.arrive;
    return CAND.map(function (k) {
      var o = { before: k, at: st - k, n: 0, cap: 0, rest: 0, restCap: 0, now: k === D.rule.entry };
      f.classes.forEach(function (c) {
        if (!Object.prototype.hasOwnProperty.call(c.days, day)) return;
        var cs = span(c)[0];
        if (st - k < cs && cs - a < st) { o.n++; o.cap += c.cap; if (!isUnk(c)) { o.rest++; o.restCap += c.cap; } }
      });
      return o;
    });
  }
  // 도착 그림의 칸: 공연 시작 lead 분 전부터 공연 시작 전까지 도착 구간이 드는 그날 수업을 시작 시각별로 묶는다.
  // 조건식은 candidates() 와 같다(k 자리에 lead). 그래서 「칸이 후보 k 의 관리 대상인가」는 covered() 하나로 갈린다.
  function arrivals(D, f, show, lead) {
    var st = toMin(show.start), day = dd(show), a = D.rule.arrive, m = {};
    f.classes.forEach(function (c) {
      if (!Object.prototype.hasOwnProperty.call(c.days, day)) return;
      var cs = span(c)[0];
      if (!(st - lead < cs && cs - a < st)) return;
      var o = m[cs] || (m[cs] = { cs: cs, n: 0, cap: 0, rest: 0, restCap: 0 });
      o.n++; o.cap += c.cap; if (!isUnk(c)) { o.rest++; o.restCap += c.cap; }
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (p, q) { return p.cs - q.cs; });
  }
  function covered(col, st, k) { return st - k < col.cs; }   // arrivals() 가 이미 cs − arrive < st 를 걸렀다

  function compute(D, f) {
    var r = D.rule, byDay = {}, groups = {}, ids = {};
    // cap·restCap·secCap = 회차마다 정원을 더한 값(같은 강좌가 공연 날마다 다시 더해짐, 하루·공연 하나 단위에 씀)
    // classCap·restClassCap·kidClassCap·secClassCap = 강좌마다 정원을 한 번만 더한 값(달 합계에 씀)
    var total = { nClasses: 0, sessions: 0, cap: 0, sec: 0, secCap: 0, kidCap: 0, kidSecCap: 0, rest: 0, restCap: 0, unkClasses: 0,
      classCap: 0, restClassCap: 0, kidClassCap: 0, secClassCap: 0 };
    var shows = D.shows.map(function (s) {
      var st = toMin(s.start);
      var b = { show: s, day: dd(s), start: st, entry: [st - r.entry, st], exit: [st + r.exit0, st + r.exit1],
        n: 0, cap: 0, sec: 0, secCap: 0, first: null, last: null, rest: 0, restCap: 0, restFirst: null, blocks: {}, secBlocks: {}, bits: { 1: {}, 2: {}, 4: {} }, who: { 1: {}, 2: {}, 4: {} } };
      byDay[b.day] = b; return b;
    });
    f.classes.forEach(function (c) {
      var sp = span(c), gname = c.group || "", g = groups[gname], hit = false, meet = false, unk = isUnk(c);
      if (unk) total.unkClasses++;
      if (!g) g = groups[gname] = { name: gname, kid: isKid(c), nClasses: 0, sessions: 0, cap: 0, classCap: 0, sec: 0, secCap: 0, secClassCap: 0, all: 0 };
      g.all++;
      for (var day in c.days) {
        var code = c.days[day], b = byDay[day];
        if (!b) continue;
        [1, 2, 4].forEach(function (bit) {   // who = 시작 시각마다 강습반 묶음(반 구분이 비면 종목)별 강좌 수 — 공지 초안에 씀
          if (!(code & bit)) return;
          b.bits[bit][sp[0]] = (b.bits[bit][sp[0]] || 0) + 1;
          var w = b.who[bit][sp[0]] || (b.who[bit][sp[0]] = {}), lab = c.group || c.kind || "구분 없음"; w[lab] = (w[lab] || 0) + 1;
        });
        if (prim(code)) {
          hit = true; total.sessions++; total.cap += c.cap; g.sessions++; g.cap += c.cap; if (g.kid) total.kidCap += c.cap;
          b.n++; b.cap += c.cap;
          var a0 = sp[0] - r.arrive, l1 = sp[1] + r.leave;
          if (b.first === null || a0 < b.first) b.first = a0;
          if (b.last === null || l1 > b.last) b.last = l1;
          if (!unk) { total.rest++; total.restCap += c.cap; b.rest++; b.restCap += c.cap; if (b.restFirst === null || a0 < b.restFirst) b.restFirst = a0; }
          var k = b.blocks[sp[0]] || (b.blocks[sp[0]] = { start: sp[0], end: sp[1], n: 0, cap: 0, come: false, go: false });
          k.n++; k.cap += c.cap; if (sp[1] > k.end) k.end = sp[1]; if (code & 1) k.come = true; if (code & 2) k.go = true;
        } else if (secOnly(code)) {
          meet = true; total.sec++; total.secCap += c.cap; g.sec++; g.secCap += c.cap; if (g.kid) total.kidSecCap += c.cap;
          b.sec++; b.secCap += c.cap;
          var m = b.secBlocks[sp[0]] || (b.secBlocks[sp[0]] = { start: sp[0], end: sp[1], n: 0, cap: 0 });
          m.n++; m.cap += c.cap; if (sp[1] > m.end) m.end = sp[1];
        }
      }
      if (hit) {
        ids[c.id] = 1; g.nClasses++; g.classCap += c.cap; total.classCap += c.cap;
        if (g.kid) total.kidClassCap += c.cap;
        if (!unk) total.restClassCap += c.cap;
      }
      if (meet) { g.secClassCap += c.cap; total.secClassCap += c.cap; }
    });
    total.nClasses = Object.keys(ids).length;
    function sorted(o) { return Object.keys(o).map(function (k) { return o[k]; }).sort(function (p, q) { return p.start - q.start; }); }
    shows.forEach(function (b) { b.blockList = sorted(b.blocks); b.secList = sorted(b.secBlocks); b.cand = candidates(D, f, b.show); b.arr = arrivals(D, f, b.show, LEAD); });
    var glist = Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (p, q) { return (p.kid - q.kid) || (q.sessions - p.sessions) || (q.sec - p.sec) || (p.name < q.name ? -1 : 1); });
    return { fac: f, shows: shows, total: total, groups: glist };
  }
  // 후보마다 한 달 합(공연 날마다 더함)
  function candTotals(res) {
    return CAND.map(function (k, i) {
      var o = { k: k, n: 0, cap: 0, rest: 0, restCap: 0 };
      res.shows.forEach(function (b) { var c = b.cand[i]; o.n += c.n; o.cap += c.cap; o.rest += c.rest; o.restCap += c.restCap; });
      return o;
    });
  }
  // 공연 제목에서 큰 글자로 쓸 짧은 이름: 해·「콘서트」 같은 꾸밈말을 낱말 단위로 덜어 낸다. 남는 게 없거나 길면 제목 그대로.
  var STOP = /^(월드투어|전국투어|투어|앵콜|앙코르|콘서트|서울|내한|단독|공연|in|seoul|encore|encor|world|tour|live|concert)$/i;
  function shortName(title, over) {
    if (over && over[title]) return over[title];
    var t = String(title).replace(/[()\[\]〈〉<>「」]/g, " ").split(/\s+/).map(function (w) { return w.replace(/^20\d\d(년)?/, ""); }).filter(function (w) { return w && !STOP.test(w); }).join(" ");
    return t && t.length <= 14 ? t : String(title);
  }

  function noticeText(D, G, f, R) {
    var r = D.rule, MM = +D.month.slice(5, 7), YY = +D.month.slice(0, 4), L = [];
    function md(s) { return MM + "월 " + (+dd(s)) + "일(" + s.dow + ")"; }
    L.push("[" + f.name + "] " + YY + "년 " + MM + "월 공연 날 수업 안내 (초안)");
    L.push("");
    L.push("올림픽공원에 공연이 있는 날, 아래 시각에 시작하는 수업은 오가는 시간이 공연 차량이 몰리는 시간과 겹칩니다.");
    L.push("겹침 기준(가정): 수업 시작 " + r.arrive + "분 전~시작에 도착, 수업 끝~" + r.leave + "분 뒤에 출발.");
    var quiet = [];
    R.shows.forEach(function (b) {
      var s = b.show, any = b.n + b.sec;
      if (!any) { quiet.push(md(s)); return; }
      L.push("");
      L.push("■ " + md(s) + " 「" + s.title + "」 " + s.start + " 시작");
      function lines(bit, headText) {   // 시작 시각 묶음마다 강습반 묶음별 강좌 수(많은 순)
        var ks = Object.keys(b.bits[bit]).map(Number).sort(function (p, q) { return p - q; }); if (!ks.length) return;
        L.push(" · " + headText);
        ks.forEach(function (k) {
          var w = b.who[bit][k];
          L.push("   " + clock(k) + " 시작 — " + Object.keys(w).sort(function (p, q) { return (w[q] - w[p]) || (p < q ? -1 : 1); }).map(function (g) { return g + " " + w[g] + "개 반"; }).join(" · "));
        });
      }
      lines(1, "올 때 겹치는 수업(공연 보러 오는 차가 몰리는 " + clock(b.entry[0]) + "~" + clock(b.entry[1]) + ")");
      lines(2, "갈 때 겹치는 수업(공연 끝나고 차가 빠지는 " + clock(b.exit[0]) + "~" + clock(b.exit[1]) + ")");
      lines(4, "나가는 길에 들어오는 차와 마주치는 수업(" + clock(b.entry[0]) + "~" + clock(b.entry[1]) + ")");
    });
    if (quiet.length) { L.push(""); L.push("공연은 있으나 겹치는 수업이 없는 날: " + quiet.join(", ")); }
    L.push("");
    L.push("■ 이렇게 해 주세요 (주최 안내 문구)");
    G.todo.forEach(function (t, i) {
      L.push((i + 1) + ". " + t.head + " — 「" + t.quote + "」 (" + t.src + ")");
      var m = t.more && t.more[f.name]; if (m) L.push("   " + m.text + " (" + m.src + ")");
    });
    return L.join("\n");
  }

  var core = { compute: compute, candidates: candidates, arrivals: arrivals, covered: covered, candTotals: candTotals, shortName: shortName,
    CAND: CAND, LEAD: LEAD, UNIT: UNIT, noticeText: noticeText, clock: clock, prim: prim, secOnly: secOnly, isKid: isKid, isUnk: isUnk };
  if (typeof module !== "undefined" && module.exports) { module.exports = core; return; }
  root.MB_OPS = core;
  if (typeof document === "undefined") return;

  // ---------- 화면 ----------
  var D = root.MB_DATA, G = root.MB_GUIDE, F = root.MB_FACTS;
  var MM = +D.month.slice(5, 7), YY = +D.month.slice(0, 4), T0 = 360, T1 = 1440;
  var R = {}; D.facilities.forEach(function (f) { R[f.name] = compute(D, f); });
  var S = { fac: D.facilities[0], k: CAND.indexOf(D.rule.entry) >= 0 ? D.rule.entry : CAND[0] };   // 처음 고른 후보 = 지금 규칙
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function num(n) { return new Intl.NumberFormat("ko-KR").format(n); }
  function slugOf(f) { return G.fac[f.name].slug; }
  function md(s) { return MM + "." + (+dd(s)); }
  function nm(s) { return shortName(s.title, G.showName); }
  function pct(m) { return ((Math.max(T0, Math.min(T1, m)) - T0) / (T1 - T0) * 100).toFixed(3) + "%"; }
  function cell(tr, tag, text, cls, sub) { var c = el(tag, cls, text); if (tag === "th") c.scope = "row"; if (sub) c.appendChild(el("small", null, sub)); tr.appendChild(c); return c; }
  function head(tb, cols) { var th = el("thead"), tr = el("tr"); cols.forEach(function (h) { var c = el("th", h[1] || null, h[0]); c.scope = "col"; tr.appendChild(c); }); th.appendChild(tr); tb.appendChild(th); }
  function ki() { return CAND.indexOf(S.k); }
  function sqn(cap) { return Math.ceil(cap / UNIT); }
  // 네모 쌓기: 꽉 찬 네모 floor(cap/UNIT)개 + 나머지만큼 덜 찬 네모 하나. cls "h" = 빈 네모(관리 시작 전 도착·마중 섞임)
  function stk(cap, cls) {
    var d = el("span", "stk" + (cls ? " " + cls : "")), full = Math.floor(cap / UNIT), rem = cap % UNIT;
    for (var i = 0; i < full; i++) d.appendChild(document.createElement("i"));
    if (rem) { var p = document.createElement("i"); p.className = "p"; p.style.setProperty("--f", (rem / UNIT * 100).toFixed(0) + "%"); d.appendChild(p); }
    return d;
  }
  function tipOf(e, text) { e.setAttribute("data-tip", text); return e; }

  function parse() { var h = location.hash.replace(/^#\/?/, ""); S.fac = D.facilities[0]; D.facilities.forEach(function (f) { if (slugOf(f) === h) S.fac = f; }); }

  // 머리: 큰 숫자 셋 · 이달 공연 이름 · 한 달 벽
  function renderTop() {
    var res = R[S.fac.name], hitDays = res.shows.filter(function (b) { return b.n; }), firsts = hitDays.map(function (b) { return b.first; });
    $("o-lede").textContent = S.fac.name + " · " + MM + "월 공연 " + D.shows.length + "일 가운데 겹치는 수업이 있는 날 " + hitDays.length + "일" +
      (firsts.length ? " · 가장 이른 겹침 수업 도착 " + clock(Math.min.apply(null, firsts)) : "") + " · 겹치는 회차 " + num(res.total.sessions) + "회" +
      (res.total.unkClasses ? " · 테니스·골프·승마 제외 " + num(res.total.rest) + "회" : "");
    var kp = $("o-kpis"); kp.textContent = "";
    function kpi(big, unit, cap) { var d = el("div", "kpi"), b = el("b", null, big); if (unit) b.appendChild(el("small", null, unit)); d.appendChild(b); d.appendChild(el("span", null, cap)); kp.appendChild(d); }
    kpi(String(hitDays.length), "/" + D.shows.length + "일", "겹치는 날");
    kpi(firsts.length ? clock(Math.min.apply(null, firsts)) : "—", null, "가장 이른 겹침 도착");
    kpi(num(res.total.sessions), "회", "겹치는 회차" + (res.total.unkClasses ? " · 종목 제외 " + num(res.total.rest) + "회" : ""));
    var box = $("facs"); box.textContent = "";
    D.facilities.forEach(function (f) {
      var t = R[f.name].total, b = el("button", null, f.name); b.type = "button"; b.setAttribute("aria-pressed", String(f === S.fac));
      b.appendChild(el("small", null, "겹침 " + num(t.sessions) + "회 · " + num(t.nClasses) + "강좌 · 마중 " + num(t.sec) + "회"));
      b.onclick = function () { location.hash = "#" + slugOf(f); }; box.appendChild(b);
    });
    var r = D.rule;
    $("o-rule").textContent = "도착 구간(수업 시작 " + r.arrive + "분 전~시작)이 입장 몰림(공연 시작 " + r.entry + "분 전~시작)과 만나거나, 출발 구간(수업 끝~" + r.leave + "분 뒤)이 퇴장 몰림(공연 시작 " + r.exit0 + "~" + r.exit1 + "분 뒤)과 만나는 회차 · 마중 섞임 = 출발 구간이 입장 몰림과 만나는 회차(따로 셈) · 도착·출발 " + r.arrive + "분은 가정";
    renderRuleFig();
  }

  // 겹침 기준 그림: 공연 줄(입장 몰림·공연 시작·퇴장 몰림)과 수업 세 경우(올 때·갈 때·마중)를 같은 시간 줄에 놓는다. 길이는 D.rule 값 그대로.
  function renderRuleFig() {
    var r = D.rule, box = $("o-rulefig"), a = -(r.entry + r.arrive + 40), z = r.exit1 + r.leave + 20, W = z - a; box.textContent = "";
    function x(m) { return ((m - a) / W * 100).toFixed(2) + "%"; }
    function bar(row, cls, m0, m1, text) { var i = el("i", cls, text || null); i.style.left = x(m0); i.style.width = "calc(" + x(m1) + " - " + x(m0) + ")"; row.appendChild(i); return i; }
    function line(label, faint) {
      var w = el("div", "rf"), l = el("span", "rfl", label), t = el("div", "rft"); w.appendChild(l); w.appendChild(t); box.appendChild(w);
      if (faint) { bar(t, "bg", -r.entry, 0); bar(t, "bg", r.exit0, r.exit1); var v = el("i", "st bg"); v.style.left = x(0); t.appendChild(v); }
      return t;
    }
    var t0 = line("공연");
    bar(t0, "band", -r.entry, 0, "입장 몰림"); bar(t0, "band", r.exit0, r.exit1, "퇴장 몰림");
    var s = el("i", "st"); s.style.left = x(0); t0.appendChild(s); var lab = el("em", null, "공연 시작"); lab.style.left = x(0); t0.appendChild(lab);
    var len = 50, c1 = -70, t1 = line("올 때", true);      // 수업 도착 구간이 입장 몰림 안
    bar(t1, "win on", c1 - r.arrive, c1); bar(t1, "cls", c1, c1 + len, "수업");
    var e2 = r.exit0 + 20, t2 = line("갈 때", true);       // 수업 뒤 출발 구간이 퇴장 몰림 안
    bar(t2, "cls", e2 - len, e2, "수업"); bar(t2, "win on", e2, e2 + r.leave);
    var e3 = -r.entry + 30, t3 = line("마중 섞임", true);   // 수업 뒤 출발 구간이 입장 몰림 안
    bar(t3, "cls", e3 - len, e3, "수업"); bar(t3, "win ho", e3, e3 + r.leave);
    var lg = el("p", "rfn"); lg.appendChild(el("i", "win on")); lg.appendChild(document.createTextNode("도착·출발 " + r.arrive + "분(가정)")); lg.appendChild(el("i", "win ho")); lg.appendChild(document.createTextNode("출발이 입장 몰림 안 = 마중 섞임(따로 셈)")); box.appendChild(lg);
    box.setAttribute("aria-label", "겹침 기준 그림 — " + $("o-rule").textContent);
  }

  // 이달 공연 이름(큰 글자)과 한 달 벽: 날마다 네모 쌓기(고른 후보의 관리 대상 = 채운 네모, 그 전에 도착 = 빈 네모)
  function renderWall() {
    var res = R[S.fac.name], i = ki(), bill = $("o-bill"), wall = $("o-wall"); bill.textContent = ""; wall.textContent = "";
    var groups = [];
    res.shows.forEach(function (b) { var n = nm(b.show), g = groups[groups.length - 1]; if (!g || g.name !== n) { g = { name: n, title: b.show.title, days: [] }; groups.push(g); } g.days.push(b); });
    var best = 0; res.shows.forEach(function (b) { if (b.cand[i].cap > best) best = b.cand[i].cap; });
    groups.forEach(function (g) {
      var on = g.days.some(function (b) { return b.cand[i].cap > 0; }), top = best > 0 && g.days.some(function (b) { return b.cand[i].cap === best; });
      var sp = el("span", "bn" + (on ? " on" : "") + (top ? " peak" : "")); sp.appendChild(el("b", null, g.name)); sp.title = g.title;
      sp.appendChild(el("small", null, md(g.days[0].show) + (g.days.length > 1 ? "–" + (+dd(g.days[g.days.length - 1].show)) : "")));
      bill.appendChild(sp);
    });
    var labeled = res.shows.map(function (b) { return b.cand[i].cap; }).filter(function (v) { return v > 0; }).sort(function (p, q) { return q - p; })[3] || 0;   // 값 큰 네 칸에만 숫자
    groups.forEach(function (g) {
      var gw = el("div", "wg");
      g.days.forEach(function (b) {
        var lit = b.cand[i].cap, lost = b.cand[0].cap - lit, c = el("div", "wc" + (lit + lost ? "" : " zero") + (best > 0 && lit === best ? " peak" : ""));
        tipOf(c, md(b.show) + " " + b.show.dow + " " + b.show.start + " " + nm(b.show) + " — 관리 대상 도착 " + num(b.cand[i].n) + "회 · 정원 합 " + num(lit) + "명" + (lost ? " / 그 전 도착 " + num(lost) + "명" : ""));
        if (lit >= labeled && lit > 0) c.appendChild(el("span", "wn", num(lit)));
        if (lost) c.appendChild(stk(lost, "h"));
        if (lit) c.appendChild(stk(lit));
        var d = el("b", null, String(+dd(b.show))); d.appendChild(el("small", null, b.show.dow)); c.appendChild(d);
        gw.appendChild(c);
      });
      wall.appendChild(gw);
    });
    wall.setAttribute("aria-label", S.fac.name + " " + MM + "월 공연 날별, 공연 " + S.k + "분 전부터 도착하는 수업의 정원 합. 자세한 값은 아래 표");
    sizeWall();
  }
  // 한 달 벽의 네모 크기: 칸 폭에 한 줄 --w 개가 들어가게(0.5px 단위). 창 크기가 바뀌면 다시 잰다.
  function sizeWall() {
    var wall = $("o-wall"), col = wall.querySelector(".wc"); if (!col) return;
    var cs = getComputedStyle(wall), w = parseFloat(cs.getPropertyValue("--w")) || 8, g = parseFloat(cs.getPropertyValue("--g")) || 2;
    wall.style.setProperty("--s", Math.max(2, Math.floor((col.getBoundingClientRect().width - (w - 1) * g) / w * 2) / 2) + "px");
  }

  // 02 관리 시작 시각: 후보 넷(누르는 큰 숫자) · 결론 한 줄 · 공연 날마다 도착 네모 · 접어 둔 표
  function renderStart() {
    var res = R[S.fac.name], unk = res.total.unkClasses > 0, t = res.total, tots = candTotals(res), i = ki(), maxCap = Math.max.apply(null, tots.map(function (o) { return o.cap; }));
    var box = $("o-cands"); box.textContent = "";
    tots.forEach(function (o) {
      var b = el("button", "ctile" + (o.k === D.rule.entry ? " now" : "")); b.type = "button"; b.setAttribute("aria-pressed", String(o.k === S.k));
      var ck = el("span", "ck"); ck.appendChild(el("span", "pre", "공연 ")); ck.appendChild(document.createTextNode(o.k + "분 전")); b.appendChild(ck); if (o.k === D.rule.entry) b.appendChild(el("em", "cnow", "지금 규칙"));
      var v = el("b", "cv", num(o.cap)); v.appendChild(el("small", null, "명")); b.appendChild(v);
      b.appendChild(el("span", "cs", num(o.n) + "회" + (unk ? " · 종목 제외 " + num(o.rest) + "회" : "")));
      var m = el("i", "cm"); m.style.setProperty("--v", maxCap ? (o.cap / maxCap * 100).toFixed(1) + "%" : "0%"); b.appendChild(m);
      b.onclick = function () { S.k = o.k; renderStart(); renderWall(); var nb = $("o-cands").querySelector('[aria-pressed="true"]'); if (nb) nb.focus(); };   // 다시 그린 뒤에도 초점을 고른 칸에 둔다
      box.appendChild(b);
    });
    var cur = tots[i], nxt = tots[i + 1], pick = $("o-pick"); pick.textContent = "";
    pick.appendChild(el("b", null, "공연 " + cur.k + "분 전 시작"));
    pick.appendChild(document.createTextNode(" — 관리 대상 도착 " + num(cur.n) + "회 · 정원 합 " + num(cur.cap) + "명" +
      (nxt ? (nxt.cap === cur.cap ? " / " + nxt.k + "분 전으로 늦춰도 동일" : " / " + nxt.k + "분 전으로 늦추면 " + num(cur.n - nxt.n) + "회 · " + num(cur.cap - nxt.cap) + "명 관리 시작 전 도착") : "")));

    var rows = $("o-arr"), zero = $("o-arrzero"); rows.textContent = ""; zero.textContent = "";
    var a = D.rule.arrive, SPAN = LEAD + a * 2;   // 그림 한 줄의 시간 폭: 공연 (LEAD + arrive)분 전 ~ 공연 arrive분 뒤(칸이 잘리지 않게)
    var quiet = [];
    res.shows.forEach(function (b) {
      var s = b.show, st = b.start, d0 = st - LEAD - a;
      if (!b.arr.length) { quiet.push(b); return; }
      function x(m) { return ((m - d0) / SPAN * 100).toFixed(3) + "%"; }
      var lit = 0, litN = 0, lost = 0, big = 0;
      b.arr.forEach(function (c) { if (covered(c, st, S.k)) { lit += c.cap; litN += c.n; } else lost += c.cap; if (c.cap > big) big = c.cap; });
      var row = el("div", "arow"), hd = el("div", "ahead"), dt = el("span", "dt", md(s)); dt.appendChild(el("small", null, s.dow)); hd.appendChild(dt);
      var name = el("b", "nm", nm(s)); name.title = s.title; hd.appendChild(name);
      var sum = el("span", "asum"); sum.appendChild(el("b", null, num(lit))); sum.appendChild(document.createTextNode("명 · " + num(litN) + "회"));
      if (lost) sum.appendChild(el("small", null, "그 전 도착 " + num(lost) + "명"));
      hd.appendChild(sum); row.appendChild(hd);
      var plot = el("div", "aplot"); plot.setAttribute("data-viz", ""); plot.setAttribute("role", "img");
      plot.setAttribute("aria-label", md(s) + " " + s.dow + " " + s.start + " " + s.title + " — " + clock(st - S.k) + "부터 도착 " + num(litN) + "회 · 정원 합 " + num(lit) + "명" + (lost ? ", 그 전 도착 " + num(lost) + "명" : ""));
      plot.style.setProperty("--r6", Math.ceil(sqn(big) / 6)); plot.style.setProperty("--r5", Math.ceil(sqn(big) / 5));
      b.arr.forEach(function (c) {
        var on = covered(c, st, S.k), col = el("div", "acol" + (on ? " on" : ""));
        col.style.left = x(c.cs - a); col.style.width = "calc(" + x(c.cs) + " - " + x(c.cs - a) + ")";
        tipOf(col, clock(c.cs) + " 시작 수업 " + num(c.n) + "회 · 도착 " + clock(c.cs - a) + "~" + clock(c.cs) + " · 정원 합 " + num(c.cap) + "명" + (unk && c.rest !== c.n ? " · 종목 제외 " + num(c.rest) + "회" : "") + (on ? "" : " · 관리 시작 전"));
        col.appendChild(stk(c.cap, on ? null : "h")); plot.appendChild(col);
      });
      var ln = el("i", "aline"); ln.style.left = x(st - S.k); ln.appendChild(el("span", null, clock(st - S.k) + " 관리 시작")); plot.appendChild(ln);
      var sl = el("i", "ashow"); sl.style.left = x(st); plot.appendChild(sl);
      row.appendChild(plot);
      var ax = el("div", "aax"); ax.setAttribute("aria-hidden", "true");
      for (var m = Math.ceil(d0 / 30) * 30; m <= d0 + SPAN; m += 30) {
        var tk = el("i", m % 60 ? null : "h"); tk.style.left = x(m); ax.appendChild(tk);
        if (m % 60 === 0 && m < st) { var lb = el("span", null, pad(Math.floor(m / 60) % 24)); lb.style.left = x(m); ax.appendChild(lb); }
      }
      var se = el("span", "se", s.start + " 공연"); se.style.left = x(st); ax.appendChild(se);
      row.appendChild(ax); rows.appendChild(row);
    });
    if (quiet.length) {
      zero.appendChild(el("b", null, "도착 수업 없음 " + quiet.length + "일"));
      quiet.forEach(function (b) { zero.appendChild(tipOf(el("span", null, md(b.show) + " " + b.show.dow), md(b.show) + " " + b.show.dow + " " + b.show.start + " " + b.show.title + " — 공연 " + LEAD + "분 전부터 도착하는 수업 없음")); });
    }

    // 접어 둔 표(정확한 값·화면 읽기용): 줄 = 공연 날 · 칸 = 관리 시작 후보 시각(그 뒤 공연 시작 전까지 도착하는 회차)
    var tb = $("o-start"); tb.textContent = "";
    $("o-unk").textContent = unk ? "수업 장소 칸 없음 — 테니스·골프·승마는 건물 밖 수업 가능. 칸마다 종목 제외 회차 병기" : "";
    tb.appendChild(el("caption", "sr", S.fac.name + " " + MM + "월 공연 날별 관리 시작 후보 시각과 그 뒤 도착하는 수업"));
    var hs = CAND.map(function (k) { return "공연 시작 " + k + "분 전" + (k === D.rule.entry ? " · 지금 규칙" : ""); });
    head(tb, [["공연 날"]].concat(CAND.map(function (k, j) { return [hs[j], k === D.rule.entry ? "now" : null]; })));
    var body = el("tbody"); tb.appendChild(body);
    res.shows.forEach(function (b) {
      var s = b.show, tr = el("tr"); body.appendChild(tr);
      if (!b.cand.some(function (o) { return o.n > 0; })) tr.className = "zero";   // 어느 후보에도 도착 수업이 없는 날은 흐리게
      cell(tr, "th", md(s) + " " + s.dow + " · " + s.start, null, s.title);
      b.cand.forEach(function (o, j) {
        var c = el("td", o.now ? "now" : null); c.setAttribute("data-h", hs[j]);
        c.appendChild(el("span", "ct", clock(o.at)));
        c.appendChild(el("small", null, num(o.n) + "회 · 정원 합 " + num(o.cap) + "명"));
        if (unk) c.appendChild(el("small", null, "종목 제외 시 " + num(o.rest) + "회"));
        tr.appendChild(c);
      });
    });
    $("o-sum").textContent = "합계 — 겹치는 회차 " + num(t.sessions) + "회 · 강좌 정원 합(상한) " + num(t.classCap) + "명 · 회차마다 더하면 " + num(t.cap) + "명" +
      (unk ? " · 테니스·골프·승마 제외 " + num(t.rest) + "회 · 강좌 정원 합(상한) " + num(t.restClassCap) + "명" : "") + " · 마중 섞임 " + num(t.sec) + "회";
  }

  // 03 공연별 시간 띠: 띠 = 입장·퇴장 몰림, 막대 = 수업 시작 시각(높이 = 정원 합, 같은 눈금), 빈 막대 = 마중 섞임
  function strip(b, top) {
    var w = el("div", "strip"); w.setAttribute("data-viz", ""); w.setAttribute("role", "img");
    w.setAttribute("aria-label", md(b.show) + " " + b.show.title + " — 겹치는 회차 " + b.n + " · 정원 합(상한) " + num(b.cap) + "명" + (b.sec ? " · 마중 섞임 " + b.sec + "회" : ""));
    function band(a, z, text) { var d = el("i", "sb"); d.style.left = pct(a); d.style.width = "calc(" + pct(z) + " - " + pct(a) + ")"; d.appendChild(el("em", null, text)); w.appendChild(d); }
    band(b.entry[0], b.entry[1], "입장"); band(b.exit[0], b.exit[1], "퇴장");
    var sl = el("i", "sl"); sl.style.left = pct(b.start); w.appendChild(sl);
    function tick(k, cls, kind) {
      var d = el("i", "tk" + (cls ? " " + cls : "")); d.style.left = pct(k.start); d.style.height = Math.max(4, k.cap / top * 100).toFixed(1) + "%";
      tipOf(d, clock(k.start) + " 시작 · " + kind + " · " + k.n + "회 · 정원 합(상한) " + num(k.cap) + "명"); w.appendChild(d);
    }
    b.secList.forEach(function (k) { tick(k, "m", "마중 섞임"); });
    b.blockList.forEach(function (k) { tick(k, null, k.come && k.go ? "올 때·갈 때" : k.come ? "올 때" : "갈 때"); });
    return w;
  }
  function axis() {
    var a = el("div", "saxis"), step = (T1 - T0) <= 600 ? 60 : 180; a.setAttribute("aria-hidden", "true");
    for (var m = Math.ceil(T0 / step) * step; m <= T1; m += step) { var s = el("span", null, pad(m / 60)); s.style.left = pct(m); a.appendChild(s); }
    return a;
  }
  function renderStrips() {
    var res = R[S.fac.name], box = $("o-strips"), zero = $("o-zero"); box.textContent = ""; zero.textContent = "";
    var hit = res.shows.filter(function (b) { return b.n; }), lo = 1440, hi = 0, top = 1;
    hit.forEach(function (b) {
      lo = Math.min(lo, b.entry[0]); hi = Math.max(hi, b.exit[1]);
      b.blockList.concat(b.secList).forEach(function (k) { lo = Math.min(lo, k.start); hi = Math.max(hi, k.start); if (k.cap > top) top = k.cap; });
    });
    if (hit.length) { T0 = Math.max(0, Math.floor(lo / 60) * 60 - 60); T1 = Math.min(1440, Math.ceil(hi / 60) * 60 + 60); }   // 겹침이 있는 시간대만 넓게
    var quiet = [];
    res.shows.forEach(function (b) {
      var s = b.show;
      if (!b.n) { quiet.push(b); return; }
      var c = el("div", "sshow"), dt = el("div", "dt", md(s)); dt.appendChild(el("small", null, s.dow + "요일")); c.appendChild(dt);
      var body = el("div"), h = el("h3", null, nm(s)); h.title = s.title; h.appendChild(el("small", null, s.start)); body.appendChild(h);
      var sw = el("p", "swin"); sw.appendChild(el("b", null, "겹침 " + b.n + "회 · " + num(b.cap) + "명")); if (b.sec) sw.appendChild(document.createTextNode(" · 마중 " + b.sec + "회")); body.appendChild(sw);
      body.appendChild(strip(b, top)); body.appendChild(axis());
      var dl = el("details", "more"); dl.appendChild(el("summary", null, "시각별 숫자"));
      var ul = el("ul", "blocks");
      ul.appendChild(el("li", "w", s.title + " · 입장 몰림 " + clock(b.entry[0]) + "~" + clock(b.entry[1]) + " · 퇴장 몰림 " + clock(b.exit[0]) + "~" + clock(b.exit[1])));
      b.blockList.forEach(function (k) {
        ul.appendChild(el("li", null, clock(k.start) + " 시작 · " + (k.come && k.go ? "올 때·갈 때" : k.come ? "올 때" : "갈 때") + " · " + k.n + "회 · 정원 합(상한) " + num(k.cap) + "명"));
      });
      b.secList.forEach(function (k) { ul.appendChild(el("li", "m", clock(k.start) + " 시작 · 마중 섞임 · " + k.n + "회 · 정원 합(상한) " + num(k.cap) + "명")); });
      dl.appendChild(ul); body.appendChild(dl); c.appendChild(body); box.appendChild(c);
    });
    if (quiet.length) {
      zero.appendChild(el("b", null, "겹치는 수업 없음 " + quiet.length + "일"));
      quiet.forEach(function (b) {
        zero.appendChild(tipOf(el("span", b.sec ? "m" : null, md(b.show) + " " + b.show.dow + (b.sec ? " · 마중 " + b.sec : "")),
          md(b.show) + " " + b.show.dow + " " + b.show.start + " · " + b.show.title + " — 겹치는 수업 없음" + (b.sec ? " · 마중 섞임 " + b.sec + "회(" + b.secList.map(function (k) { return clock(k.start); }).join("·") + " 시작)" : "")));
      });
    } else zero.appendChild(el("b", null, "공연 날 모두 겹치는 수업 있음"));
  }

  // 04 강습반별: 네모 넓이 = 겹치는 강좌의 정원 합(상한). 겹침이 없는 반은 한 줄로 모은다. 표는 접어 둔다.
  function renderGroups() {
    var res = R[S.fac.name], tb = $("o-groups"), bars = $("o-gbars"), none = $("o-gzero"), t = res.total; tb.textContent = ""; bars.textContent = ""; none.textContent = "";
    var quiet = [];
    res.groups.forEach(function (g) {
      if (!(g.sessions || g.sec)) { quiet.push(g.name || "구분 없음"); return; }
      var row = el("div", "grow"), hd = el("div", "gh"), name = el("b", "gname", g.name || "구분 없음"); if (g.kid) name.appendChild(el("small", null, "어린이반")); hd.appendChild(name);
      var v = el("span", "gv"); v.appendChild(el("b", null, num(g.classCap))); v.appendChild(document.createTextNode("명")); hd.appendChild(v);
      hd.appendChild(el("span", "gs", num(g.nClasses) + "강좌 · " + num(g.sessions) + "회" + (g.sec ? " · 마중 " + num(g.sec) + "회" : "")));
      row.appendChild(hd);
      var plot = el("div", "gplot"); plot.setAttribute("data-viz", ""); plot.setAttribute("role", "img");
      plot.setAttribute("aria-label", (g.name || "구분 없음") + " — 겹치는 강좌 " + g.nClasses + "개 · 겹치는 회차 " + g.sessions + " · 강좌 정원 합(상한) " + num(g.classCap) + "명" + (g.sec ? " · 마중 섞임 " + g.sec + "회" : ""));
      if (g.classCap) plot.appendChild(stk(g.classCap));
      if (g.secClassCap) plot.appendChild(tipOf(stk(g.secClassCap, "h"), "마중 섞임 강좌 정원 합(상한) " + num(g.secClassCap) + "명"));
      row.appendChild(plot); bars.appendChild(row);
    });
    if (quiet.length) { none.appendChild(el("b", null, "겹침 없음")); quiet.forEach(function (n) { none.appendChild(el("span", null, n)); }); }

    tb.appendChild(el("caption", "sr", S.fac.name + " " + MM + "월 강습반별 겹치는 회차"));
    head(tb, [["강습반(자료의 반 구분)"], ["겹치는 강좌", "num"], ["겹치는 회차", "num"], ["강좌 정원 합(상한)", "num"], ["마중 섞임 회차", "num"], ["마중 강좌 정원 합(상한)", "num"]]);
    var body = el("tbody"); tb.appendChild(body);
    function row(g) {
      var tr = el("tr", g.sessions || g.sec ? null : "zero"); body.appendChild(tr);
      cell(tr, "th", g.name || "구분 없음", null, "강좌 " + g.all + "개 중");
      cell(tr, "td", num(g.nClasses), "num"); cell(tr, "td", num(g.sessions), "num"); cell(tr, "td", num(g.classCap) + "명", "num");
      cell(tr, "td", num(g.sec), "num"); cell(tr, "td", num(g.secClassCap) + "명", "num");
    }
    function sub(text) { var tr = el("tr", "sub"), c = el("th", null, text); c.scope = "colgroup"; c.colSpan = 6; tr.appendChild(c); body.appendChild(tr); }
    var adults = res.groups.filter(function (g) { return !g.kid; }), kids = res.groups.filter(function (g) { return g.kid; });
    sub("어린이반 밖"); adults.forEach(row);
    sub("어린이반" + (kids.length ? " · 강좌 정원 합(상한) " + num(t.kidClassCap) + "명" : ""));
    if (kids.length) kids.forEach(row);
    else { var tr = el("tr", "zero"), c = el("td", null, "반 구분 「어린이」 강좌 없음(이 시설 자료 기준)"); c.colSpan = 6; tr.appendChild(c); body.appendChild(tr); }
    var foot = el("tfoot"), fr = el("tr"); foot.appendChild(fr); tb.appendChild(foot);
    cell(fr, "th", "합계"); cell(fr, "td", num(t.nClasses), "num"); cell(fr, "td", num(t.sessions), "num"); cell(fr, "td", num(t.classCap) + "명", "num", "회차마다 더하면 " + num(t.cap) + "명");
    cell(fr, "td", num(t.sec), "num"); cell(fr, "td", num(t.secClassCap) + "명", "num", "회차마다 더하면 " + num(t.secCap) + "명");
  }

  function renderNotice() { $("o-notice").value = noticeText(D, G, S.fac, R[S.fac.name]); $("o-copymsg").textContent = ""; }
  function copyNotice() {
    var ta = $("o-notice"), msg = $("o-copymsg"), txt = ta.value;
    function done() { msg.textContent = "공지 초안 복사 완료"; }
    function fallback() { ta.focus(); ta.select(); try { if (document.execCommand("copy")) done(); else msg.textContent = "복사 실패 — 글을 직접 골라 복사"; } catch (e) { msg.textContent = "복사 실패 — 글을 직접 골라 복사"; } }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
  }

  function statusLine(rows) {   // 일치를 앞에, 나머지는 처음 나온 차례대로
    var c = {}, order = [];
    rows.forEach(function (x) { if (!(x.status in c)) { c[x.status] = 0; order.push(x.status); } c[x.status]++; });
    order.sort(function (p, q) { return (q === "일치") - (p === "일치"); });
    return order.map(function (s) { return s + " " + c[s]; }).join(" · ");
  }
  // 06 달력 맞대기: 날짜 칸 한 줄(어긋난 날 = 노랑) · 어긋난 날만 글로 · 표는 접어 둔다
  function renderCal() {
    var cc = F.calcheck || [], rc = F.rentalcheck, three = !!(rc && rc.length), tb = $("o-cal"), days = $("o-caldays"), bad = $("o-calbad"); tb.textContent = ""; days.textContent = ""; bad.textContent = "";
    tb.appendChild(el("caption", "sr", three ? "월간 공지·공연정보·대관정보의 날짜·시각 맞대기" : "월간 공지와 공연정보의 날짜·시각 맞대기"));
    head(tb, [["날짜"], ["수영장 월간 공지"], ["주최 공연정보"]].concat(three ? [["주최 대관정보"]] : []).concat([["맞대기"]]));
    var C = {}, RR = {}, SH = {}, dates = {}, body = el("tbody"); tb.appendChild(body);
    cc.forEach(function (x) { C[x.date] = x; dates[x.date] = x.dow; });
    if (three) rc.forEach(function (x) { RR[x.date] = x; dates[x.date] = x.dow; });
    D.shows.forEach(function (s) { SH[s.date] = s; });
    Object.keys(dates).sort().forEach(function (d) {
      var c = C[d], r = RR[d], s = SH[d], isBad = (c && c.status !== "일치") || (r && r.status !== "일치");
      var tr = el("tr", isBad ? "mark" : null); body.appendChild(tr);
      var dlab = d.slice(5).replace("-", ".") + " " + dates[d];
      cell(tr, "th", dlab);
      var nStart = c && c.notice ? c.notice.start : r && r.notice_start ? r.notice_start : s ? s.start : null, nTitle = c && c.notice ? c.notice.title : s ? s.title : null;
      cell(tr, "td", nStart || "목록에 없음", null, nTitle);
      if (c) cell(tr, "td", c.events ? c.events.start : "목록에 없음", null, c.events ? c.events.title : null); else cell(tr, "td", "맞대기 자료 없음");
      if (three) {
        if (!r) cell(tr, "td", "맞대기 자료 없음");
        else if (!r.rental) cell(tr, "td", "목록에 없음");
        else { var rcl = cell(tr, "td", r.rental.start || "시각 못 읽음", null, r.rental.title); if (r.status === "날짜 못 읽음" && r.rental.raw) rcl.appendChild(el("small", null, "원문: " + r.rental.raw)); }
      }
      var verdict = [c ? "공연정보 " + c.status : null, three && r ? (r.status.indexOf("대관정보") === 0 ? r.status : "대관정보 " + r.status) : null].filter(Boolean).join(" · ");
      cell(tr, "td", verdict);
      var dc = el("span", "cd" + (isBad ? " bad" : ""), String(+d.slice(8))); dc.appendChild(el("small", null, dates[d])); tipOf(dc, dlab + " — " + verdict); days.appendChild(dc);
      if (isBad) { var li = el("li"); li.appendChild(el("b", null, dlab)); li.appendChild(document.createTextNode(" 공지 " + (nStart || "없음") + " · " + verdict)); bad.appendChild(li); }
    });
    $("o-calsum").textContent = (three ? "공지 × 대관정보 " + rc.length + "일: " + statusLine(rc) + " / " : "") + "공지 × 공연정보 " + cc.length + "일: " + statusLine(cc);
    var miss = three ? [] : D.shows.filter(function (s) { return !C[s.date]; }).map(function (s) { return md(s) + " " + s.dow; });
    $("o-calnote").textContent = "맞대기 자료 작성 " + F.made + (miss.length ? " · 맞대기 자료에 없는 공연 날(" + D.shows.length + "일 중): " + miss.join(", ") : "");
  }

  function renderSelf() {
    var src = $("o-src"); src.textContent = "";
    G.src.forEach(function (line) { src.appendChild(el("li", null, line)); });
    src.appendChild(el("li", null, "주최 안내 열람일 " + G.seen + " · 계산한 때 " + D.made));
    src.appendChild(el("li", null, "자체 점검 — " + D.facilities.map(function (f) {
      var t = R[f.name].total;
      return f.name + " " + num(t.nClasses) + "강좌 · " + num(t.sessions) + "회 · 강좌 정원 합(상한) " + num(t.classCap) + "명 · 마중 섞임 " + num(t.sec) + "회";
    }).join(" / ") + D.facilities.filter(function (f) { return R[f.name].total.unkClasses; }).map(function (f) {
      var t = R[f.name].total; return " / " + G.fac[f.name].short + " 장소 미확인 종목 제외 " + num(t.rest) + "회 · 강좌 정원 합(상한) " + num(t.restClassCap) + "명";
    }).join("") + " (" + D.month + ")"));
  }

  // 그림 위에 올리거나 누르면 뜨는 한 줄(값은 data-tip). 정확한 값은 접어 둔 표에도 있다.
  function tips() {
    var tip = el("div", "tip"); tip.setAttribute("role", "status"); tip.hidden = true; document.body.appendChild(tip);
    function show(t) {
      tip.textContent = t.getAttribute("data-tip"); tip.hidden = false;
      var r = t.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, vw = document.documentElement.clientWidth;
      tip.style.left = Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2)) + window.scrollX + "px";
      tip.style.top = (r.top - h - 8 < 4 ? r.bottom + 8 : r.top - h - 8) + window.scrollY + "px";
    }
    document.addEventListener("pointerover", function (ev) { var t = ev.target.closest && ev.target.closest("[data-tip]"); if (t) show(t); else tip.hidden = true; });
    document.addEventListener("pointerdown", function (ev) { var t = ev.target.closest && ev.target.closest("[data-tip]"); if (t) show(t); else tip.hidden = true; });
    window.addEventListener("scroll", function () { tip.hidden = true; }, { passive: true });
  }

  function render() {
    parse(); renderTop(); renderWall(); renderStart(); renderStrips(); renderGroups(); renderNotice(); renderCal();
    $("live").textContent = S.fac.name + " 운영 화면 표시";
  }
  function renderMonth() {   // 머리의 달 표시와 달 단추는 load.js 몫(없으면 달 이름만)
    var LD = root.MB_LOAD; if (LD && LD.month === D.month) LD.mount($("monthtag")); else $("monthtag").textContent = YY + " · " + pad(MM);
    $("o-groupnote").textContent = "반 구분은 강좌정보 자료 기준. 겹치는 강좌 = " + MM + "월 겹치는 회차가 하나 이상인 강좌";
    $("o-unit").textContent = "네모 하나 = 정원 " + UNIT + "명(상한 · 실제 온 회원 수 아님)";
  }
  $("o-copy").onclick = copyNotice;
  window.addEventListener("hashchange", render);
  var rz = 0; window.addEventListener("resize", function () { cancelAnimationFrame(rz); rz = requestAnimationFrame(sizeWall); });
  renderMonth(); render(); renderSelf(); tips(); $("live").textContent = "";
})(typeof window !== "undefined" ? window : this);
