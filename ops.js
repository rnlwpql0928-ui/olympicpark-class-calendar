/* 회원 먼저 — 운영 화면.
 * 숫자는 모두 data/*.js 에서 읽어 센다(회차·정원·시각을 여기에 적지 않는다).
 * days 값(app.js 와 같음): 1 오는 길×입장 몰림 · 2 가는 길×퇴장 몰림 · 4 가는 길×입장 몰림(마중 섞임) · 0 그날 수업은 있으나 안 겹침 · 키 없음 = 그날 수업 없음.
 * 겹치는 회차 = 1 또는 2가 든 회차. 마중 섞임 회차 = 4만 든 회차(1·2가 함께 들면 겹치는 회차로 센다).
 * 계산 부분(core)은 node 에서도 불러 쓸 수 있다: require("./ops.js").compute(MB_DATA, 시설).
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
    shows.forEach(function (b) { b.blockList = sorted(b.blocks); b.secList = sorted(b.secBlocks); b.cand = candidates(D, f, b.show); });
    var glist = Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (p, q) { return (p.kid - q.kid) || (q.sessions - p.sessions) || (q.sec - p.sec) || (p.name < q.name ? -1 : 1); });
    return { fac: f, shows: shows, total: total, groups: glist };
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

  var core = { compute: compute, candidates: candidates, CAND: CAND, noticeText: noticeText, clock: clock, prim: prim, secOnly: secOnly, isKid: isKid, isUnk: isUnk };
  if (typeof module !== "undefined" && module.exports) { module.exports = core; return; }
  root.MB_OPS = core;
  if (typeof document === "undefined") return;

  // ---------- 화면 ----------
  var D = root.MB_DATA, G = root.MB_GUIDE, F = root.MB_FACTS;
  var MM = +D.month.slice(5, 7), YY = +D.month.slice(0, 4), T0 = 360, T1 = 1440;
  var R = {}; D.facilities.forEach(function (f) { R[f.name] = compute(D, f); });
  var S = { fac: D.facilities[0] };
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function num(n) { return new Intl.NumberFormat("ko-KR").format(n); }
  function slugOf(f) { return G.fac[f.name].slug; }
  function md(s) { return MM + "." + (+dd(s)); }
  function pct(m) { return ((Math.max(T0, Math.min(T1, m)) - T0) / (T1 - T0) * 100).toFixed(3) + "%"; }
  function cell(tr, tag, text, cls, sub) { var c = el(tag, cls, text); if (tag === "th") c.scope = "row"; if (sub) c.appendChild(el("small", null, sub)); tr.appendChild(c); return c; }
  function head(tb, cols) { var th = el("thead"), tr = el("tr"); cols.forEach(function (h) { var c = el("th", h[1] || null, h[0]); c.scope = "col"; tr.appendChild(c); }); th.appendChild(tr); tb.appendChild(th); }

  function parse() { var h = location.hash.replace(/^#\/?/, ""); S.fac = D.facilities[0]; D.facilities.forEach(function (f) { if (slugOf(f) === h) S.fac = f; }); }

  function renderTop() {
    var res = R[S.fac.name], hitDays = res.shows.filter(function (b) { return b.n; }), firsts = hitDays.map(function (b) { return b.first; });
    var le = $("o-lede"); le.textContent = "";
    le.appendChild(el("b", null, S.fac.name));
    le.appendChild(document.createTextNode(" · " + MM + "월 공연 " + D.shows.length + "일 가운데 겹치는 수업이 있는 날 " + hitDays.length + "일" +
      (firsts.length ? " · 가장 이른 겹침 수업 도착 " + clock(Math.min.apply(null, firsts)) : "") + " · 겹치는 회차 " + num(res.total.sessions) + "회" +
      (res.total.unkClasses ? " · 테니스·골프·승마 제외 " + num(res.total.rest) + "회" : "")));
    var box = $("facs"); box.textContent = "";
    D.facilities.forEach(function (f) {
      var t = R[f.name].total, b = el("button", null, f.name); b.type = "button"; b.setAttribute("aria-pressed", String(f === S.fac));
      b.appendChild(el("small", null, MM + "월 겹치는 회차 " + num(t.sessions) + "회 · 강좌 " + num(t.nClasses) + "개 · 마중 섞임 " + num(t.sec) + "회"));
      b.onclick = function () { location.hash = "#" + slugOf(f); }; box.appendChild(b);
    });
    var r = D.rule, ru = $("o-rule"); ru.textContent = "";
    ru.appendChild(el("b", null, "겹침 기준"));
    ru.appendChild(document.createTextNode(" 도착 구간(수업 시작 " + r.arrive + "분 전~시작)이 입장 몰림(공연 시작 " + r.entry + "분 전~시작)과 만나거나, 출발 구간(수업 끝~" + r.leave + "분 뒤)이 퇴장 몰림(공연 시작 " + r.exit0 + "~" + r.exit1 + "분 뒤)과 만나는 회차 · 마중 섞임 = 출발 구간이 입장 몰림과 만나는 회차(따로 셈) · 도착·출발 " + r.arrive + "분은 가정"));
  }

  function renderStart() {   // 줄 = 공연 날 · 칸 = 관리 시작 후보 시각(그 뒤 공연 시작 전까지 도착하는 회차)
    var res = R[S.fac.name], tb = $("o-start"), unk = res.total.unkClasses > 0, t = res.total; tb.textContent = "";
    $("o-unk").textContent = unk ? "수업 장소 칸 없음 — 테니스·골프·승마는 건물 밖 수업 가능. 칸마다 종목 제외 회차 병기" : "";
    tb.appendChild(el("caption", "sr", S.fac.name + " " + MM + "월 공연 날별 관리 시작 후보 시각과 그 뒤 도착하는 수업"));
    var hs = CAND.map(function (k) { return "공연 시작 " + k + "분 전" + (k === D.rule.entry ? " · 지금 규칙" : ""); });
    head(tb, [["공연 날"]].concat(CAND.map(function (k, i) { return [hs[i], k === D.rule.entry ? "now" : null]; })));
    var body = el("tbody"); tb.appendChild(body);
    res.shows.forEach(function (b) {
      var s = b.show, tr = el("tr"); body.appendChild(tr);
      if (!b.cand.some(function (o) { return o.n > 0; })) tr.className = "zero";   // 어느 후보에도 도착 수업이 없는 날은 흐리게
      cell(tr, "th", md(s) + " " + s.dow + " · " + s.start, null, s.title);
      b.cand.forEach(function (o, i) {
        var c = el("td", o.now ? "now" : null); c.setAttribute("data-h", hs[i]);
        c.appendChild(el("span", "ct", clock(o.at)));
        c.appendChild(el("small", null, num(o.n) + "회 · 정원 합 " + num(o.cap) + "명"));
        if (unk) c.appendChild(el("small", null, "종목 제외 시 " + num(o.rest) + "회"));
        tr.appendChild(c);
      });
    });
    $("o-sum").textContent = "합계 — 겹치는 회차 " + num(t.sessions) + "회 · 강좌 정원 합(상한) " + num(t.classCap) + "명 · 회차마다 더하면 " + num(t.cap) + "명" +
      (unk ? " · 테니스·골프·승마 제외 " + num(t.rest) + "회 · 강좌 정원 합(상한) " + num(t.restClassCap) + "명" : "") + " · 마중 섞임 " + num(t.sec) + "회";
  }

  function strip(b) {
    var w = el("div", "strip"); w.setAttribute("aria-hidden", "true");
    function band(a, z) { var d = el("i", "sb"); d.style.left = pct(a); d.style.width = "calc(" + pct(z) + " - " + pct(a) + ")"; w.appendChild(d); }
    band(b.entry[0], b.entry[1]); band(b.exit[0], b.exit[1]);
    var sl = el("i", "sl"); sl.style.left = pct(b.start); w.appendChild(sl);
    function tick(k, cls) { var d = el("i", "tk" + (cls ? " " + cls : "")); d.style.left = pct(k.start); d.style.height = Math.min(42, 8 + Math.sqrt(k.n) * 8).toFixed(1) + "px"; w.appendChild(d); }
    b.secList.forEach(function (k) { tick(k, "m"); });
    b.blockList.forEach(function (k) { tick(k); });
    return w;
  }
  function axis() { var a = el("div", "saxis"); a.setAttribute("aria-hidden", "true"); for (var h = 6; h <= 24; h += 3) { var s = el("span", null, pad(h)); s.style.left = pct(h * 60); a.appendChild(s); } return a; }
  function renderStrips() {
    var res = R[S.fac.name], box = $("o-strips"), zero = $("o-zero"); box.textContent = ""; zero.textContent = "";
    res.shows.forEach(function (b) {
      var s = b.show;
      if (!b.n) {
        zero.appendChild(el("li", null, md(s) + " " + s.dow + " " + s.start + " · " + s.title + " — 겹치는 수업 없음" +
          (b.sec ? " · 마중 섞임 " + b.sec + "회(" + b.secList.map(function (k) { return clock(k.start); }).join("·") + " 시작)" : ""))); return;
      }
      var c = el("div", "sshow"), dt = el("div", "dt", md(s)); dt.appendChild(el("small", null, s.dow + "요일")); c.appendChild(dt);
      var body = el("div"), h = el("h3", null, s.title + " · " + s.start + " 시작"); body.appendChild(h);
      body.appendChild(el("p", "swin", "입장 몰림 " + clock(b.entry[0]) + "~" + clock(b.entry[1]) + " · 퇴장 몰림 " + clock(b.exit[0]) + "~" + clock(b.exit[1]) +
        " · 겹치는 회차 " + b.n + " · 정원 합(상한) " + num(b.cap) + "명" + (b.sec ? " · 마중 섞임 " + b.sec + "회" : "")));
      body.appendChild(strip(b)); body.appendChild(axis());
      var ul = el("ul", "blocks");
      b.blockList.forEach(function (k) {
        ul.appendChild(el("li", null, clock(k.start) + " 시작 · " + (k.come && k.go ? "올 때·갈 때" : k.come ? "올 때" : "갈 때") + " · " + k.n + "회 · 정원 합(상한) " + num(k.cap) + "명"));
      });
      b.secList.forEach(function (k) { ul.appendChild(el("li", "m", clock(k.start) + " 시작 · 마중 섞임 · " + k.n + "회 · 정원 합(상한) " + num(k.cap) + "명")); });
      body.appendChild(ul); c.appendChild(body); box.appendChild(c);
    });
    if (!zero.children.length) zero.appendChild(el("li", null, "공연 날 모두 겹치는 수업 있음"));
  }

  function renderGroups() {
    var res = R[S.fac.name], tb = $("o-groups"); tb.textContent = "";
    tb.appendChild(el("caption", "sr", S.fac.name + " " + MM + "월 강습반별 겹치는 회차"));
    head(tb, [["강습반(자료의 반 구분)"], ["겹치는 강좌", "num"], ["겹치는 회차", "num"], ["강좌 정원 합(상한)", "num"], ["마중 섞임 회차", "num"], ["마중 강좌 정원 합(상한)", "num"]]);
    var body = el("tbody"), t = res.total; tb.appendChild(body);
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
  function statusLine(rows) {   // 일치를 앞에, 나머지는 처음 나온 차례대로
    var c = {}, order = [];
    rows.forEach(function (x) { if (!(x.status in c)) { c[x.status] = 0; order.push(x.status); } c[x.status]++; });
    order.sort(function (p, q) { return (q === "일치") - (p === "일치"); });
    return order.map(function (s) { return s + " " + c[s]; }).join(" · ");
  }
  function renderCal() {
    var cc = F.calcheck || [], rc = F.rentalcheck, three = !!(rc && rc.length), tb = $("o-cal"); tb.textContent = "";
    tb.appendChild(el("caption", "sr", three ? "월간 공지·공연정보·대관정보의 날짜·시각 맞대기" : "월간 공지와 공연정보의 날짜·시각 맞대기"));
    head(tb, [["날짜"], ["수영장 월간 공지"], ["주최 공연정보"]].concat(three ? [["주최 대관정보"]] : []).concat([["맞대기"]]));
    var C = {}, RR = {}, SH = {}, dates = {}, body = el("tbody"); tb.appendChild(body);
    cc.forEach(function (x) { C[x.date] = x; dates[x.date] = x.dow; });
    if (three) rc.forEach(function (x) { RR[x.date] = x; dates[x.date] = x.dow; });
    D.shows.forEach(function (s) { SH[s.date] = s; });
    Object.keys(dates).sort().forEach(function (d) {
      var c = C[d], r = RR[d], s = SH[d], bad = (c && c.status !== "일치") || (r && r.status !== "일치");
      var tr = el("tr", bad ? "mark" : null); body.appendChild(tr);
      cell(tr, "th", d.slice(5).replace("-", ".") + " " + dates[d]);
      var nStart = c && c.notice ? c.notice.start : r && r.notice_start ? r.notice_start : s ? s.start : null, nTitle = c && c.notice ? c.notice.title : s ? s.title : null;
      cell(tr, "td", nStart || "목록에 없음", null, nTitle);
      if (c) cell(tr, "td", c.events ? c.events.start : "목록에 없음", null, c.events ? c.events.title : null); else cell(tr, "td", "맞대기 자료 없음");
      if (three) {
        if (!r) cell(tr, "td", "맞대기 자료 없음");
        else if (!r.rental) cell(tr, "td", "목록에 없음");
        else { var rcl = cell(tr, "td", r.rental.start || "시각 못 읽음", null, r.rental.title); if (r.status === "날짜 못 읽음" && r.rental.raw) rcl.appendChild(el("small", null, "원문: " + r.rental.raw)); }
      }
      cell(tr, "td", [c ? "공연정보 " + c.status : null, three && r ? (r.status.indexOf("대관정보") === 0 ? r.status : "대관정보 " + r.status) : null].filter(Boolean).join(" · "));
    });
    $("o-calsum").textContent = (three ? "공지 × 대관정보 " + rc.length + "일: " + statusLine(rc) + " / " : "") + "공지 × 공연정보 " + cc.length + "일: " + statusLine(cc);
    var miss = three ? [] : D.shows.filter(function (s) { return !C[s.date]; }).map(function (s) { return md(s) + " " + s.dow; });
    $("o-calnote").textContent = "맞대기 자료 작성 " + F.made + (miss.length ? " · 맞대기 자료에 없는 공연 날(" + D.shows.length + "일 중): " + miss.join(", ") : "");
  }

  function renderSelf() {
    var src = $("o-src"); src.textContent = "";
    G.src.forEach(function (line) { src.appendChild(el("li", null, line)); });
    src.appendChild(el("li", null, "주최 안내 열람일 " + G.seen + " · 계산한 때 " + D.made));
    $("o-self").textContent = "자체 점검 — " + D.facilities.map(function (f) {
      var t = R[f.name].total;
      return f.name + " " + num(t.nClasses) + "강좌 · " + num(t.sessions) + "회 · 강좌 정원 합(상한) " + num(t.classCap) + "명 · 마중 섞임 " + num(t.sec) + "회";
    }).join(" / ") + D.facilities.filter(function (f) { return R[f.name].total.unkClasses; }).map(function (f) {
      var t = R[f.name].total; return " / " + G.fac[f.name].short + " 장소 미확인 종목 제외 " + num(t.rest) + "회 · 강좌 정원 합(상한) " + num(t.restClassCap) + "명";
    }).join("") + " (" + D.month + ")";
  }

  function render() {
    parse(); renderTop(); renderStart(); renderStrips(); renderGroups(); renderNotice(); renderCal();
    $("live").textContent = S.fac.name + " 운영 화면 표시";
  }
  function renderMonth() {   // 머리의 달 표시와 달 단추는 load.js 몫(없으면 달 이름만)
    var LD = root.MB_LOAD; if (LD && LD.month === D.month) LD.mount($("monthtag")); else $("monthtag").textContent = YY + " · " + pad(MM);
    $("o-groupnote").textContent = "반 구분은 강좌정보 자료 기준. 겹치는 강좌 = " + MM + "월 겹치는 회차가 하나 이상인 강좌";
  }
  $("o-copy").onclick = copyNotice;
  window.addEventListener("hashchange", render);
  renderMonth(); render(); renderSelf(); $("live").textContent = "";
})(typeof window !== "undefined" ? window : this);
