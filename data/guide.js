// 회원 먼저 — 주최가 이미 낸 안내 문구(원문 그대로)와 출처. 열람일 seen. 숫자가 든 근거는 access.js·facts.js 에서 읽는다.
window.MB_GUIDE = {
  seen: "2026-11-10",
  alarmBefore: "P1D",   // 달력 파일 알림: 하루 전
  fac: {
    "올림픽수영장": { slug: "pool", short: "수영장", near: "P4", nearCap: 117 },
    "올림픽공원스포츠센터": { slug: "sc", short: "스포츠센터", near: "P5", nearCap: 176 }
  },
  lots: { url: "https://www.ksponco.or.kr/olympicpark/parkingInfo?mid=a20111000000", label: "올림픽공원 주차 안내" },
  // 글자로 다시 그리는 사진. crop = 쓸 자리, lo·hi = 어두운 쪽·밝은 쪽을 자르는 자리(백분위), hotFrom = 이 밝기부터 노란 겹에 찍는다.
  photo: { src: "img/olympic_pool_commons.jpg", crop: { x: 0, y: 215, w: 1280, h: 500 }, cols: 104, lo: 0.2, hi: 0.995, gamma: 1.25, hotFrom: 0.84,
    cap: "올림픽수영장", cropNote: "사진 일부를 잘라 썼어요", asciiNote: "사진을 글자로 다시 그렸어요", toAscii: "글자로 보기", toPhoto: "사진으로 보기",
    credit: "주전자 · 퍼블릭 도메인 · Wikimedia Commons", page: "https://commons.wikimedia.org/wiki/File:Seoul_Olympic_Swimming_Pool.jpg" },
  voc: { n: 6, from: "2024-02-06", to: "2025-11-21", label: "주최 「고객의 소리」 공개 글", url: "https://www.ksponco.or.kr/customQna/view?cbxSearch_Type=&currentPage=1&mid=a20702000000&txtID_VOC_ORG=VB0000127665&txtSearch_Word=&txtTP_BIZ=24" },
  todo: [
    { key: "transit", when: [1, 2, 4], head: "대중교통으로",
      quote: "수영장을 이용하시는 회원 여러분께서는 가급적 대중교통을 이용하여 주시기 바랍니다.",
      src: "올림픽수영장 「2026년 11월 주차혼잡안내(행사안내)」 2026-10-28", url: "https://www.ksponco.or.kr/board.es?mid=a50301000000&bid=0001&act=view&list_no=85595" },
    { key: "car", when: [1], head: "차로 온다면",
      quote: "올림픽스포츠센터 인근 주차장 만차시 한얼(벽화), P1, P2 주차장을 이용해 주시기 바라며",
      src: "올림픽수영장 「주차공간 일부 주차금지 안내」 2024-09-23", url: "https://www.ksponco.or.kr/board.es?mid=a50301000000&bid=0001&act=view&list_no=78229",
      more: { "올림픽공원스포츠센터": { text: "주최 답변에 적힌 걷는 시간 — P2 도보 약 6분 · P6 도보 약 5분. 그만큼 일찍 나섭니다.", src: "주최 「고객의 소리」 답변(스포츠교실팀) 2025-11-25" } } },
    { key: "drop", when: [1, 4], head: "데려다주는 차라면",
      quote: "10분 이내 출차 시 무료",
      src: "올림픽공원 주차 안내", url: "https://www.ksponco.or.kr/olympicpark/parkingInfo?mid=a20111000000" }
  ],
  src: [
    "강좌·회차: 올림픽수영장 강좌정보(공공데이터포털 15101610) · 올림픽스포츠센터 강좌정보(15110953)",
    "공연 날짜·시작 시각: 올림픽수영장 월간 「주차혼잡안내」(15059528 공지사항) · 올림픽공원 공연정보(3037877) · 대관정보(15015212)",
    "들어온 차: 올림픽공원 입출차 정보(15138735, 2024-07) · 만차 기록: 주차장 혼잡도 정보(15164156, 직원 기록)",
    "할 일의 문구: 주최 공지·주차 안내·「고객의 소리」 답변 원문 그대로"
  ]
};
