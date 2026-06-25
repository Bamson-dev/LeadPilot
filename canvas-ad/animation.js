/**
 * LeadThur 9:16 canvas ad — 45s @ 30fps · 1080×1920
 */
(function (global) {
  const W = 1080;
  const H = 1920;
  const DURATION_MS = 45000;
  const FPS = 30;

  const C = {
    bg: "#07070A",
    surface: "#0F0F14",
    card: "#111113",
    surfaceAlt: "#14141C",
    rowAlt: "#0C0C12",
    purple: "#7C3AED",
    purpleLight: "#A855F7",
    green: "#10B981",
    white: "#F4F4FF",
    muted: "#6B6B80",
    border: "rgba(255,255,255,0.07)",
    gold: "#FBBF24",
    red: "#EF4444",
    black: "#000000",
    email: "#C4B5FD",
  };

  const FONT_HEAD = '"Bricolage Grotesque", sans-serif';
  const FONT_BODY = "Figtree, sans-serif";

  const TARGET_COUNT = 127;

  const T = {
    intro: [0, 3000],
    pain: [3000, 7500],
    product: [7500, 23000],
    export: [23000, 27000],
    social: [27000, 33000],
    world: [33000, 37000],
    pricing: [37000, 41000],
    close: [41000, 45000],
  };

  const LEADS = [
    {
      name: "Chicken Republic Lekki",
      address: "Admiralty Way, Lekki Phase 1",
      phone: "+234 801 234 5678",
      email: "lekki@chickenrepublic.ng",
      rating: "4.6",
    },
    {
      name: "The Yellow Chilli VI",
      address: "Akin Adesola St, Victoria Island",
      phone: "+234 803 456 7890",
      email: "hello@theyellowchilli.com",
      rating: "4.8",
    },
    {
      name: "Nkoyo Restaurant Ikoyi",
      address: "Awolowo Rd, Ikoyi",
      phone: "+234 805 678 9012",
      email: "reservations@nkoyo.com",
      rating: "4.7",
    },
    {
      name: "Cactus Restaurant Lagos",
      address: "Ozumba Mbadiwe Ave, VI",
      phone: "+234 802 345 6789",
      email: "info@cactuslagos.com",
      rating: "4.5",
    },
    {
      name: "Bukka Hut Ikeja",
      address: "Allen Ave, Ikeja",
      phone: "+234 706 789 0123",
      email: "ikeja@bukkahut.com",
      rating: "4.4",
    },
    {
      name: "Suya Spot Lekki",
      address: "Chevron Dr, Lekki",
      phone: "+234 810 234 5678",
      email: "orders@suyaspot.ng",
      rating: "4.9",
    },
    {
      name: "Southern Fried Lagos",
      address: "Agungi Rd, Lekki",
      phone: "+234 809 012 3456",
      email: "contact@southernfried.ng",
      rating: "4.3",
    },
    {
      name: "Lagoon Restaurant VI",
      address: "Sanusi Fafunwa St, VI",
      phone: "+234 808 111 2233",
      email: "dine@lagoonrestaurant.ng",
      rating: "4.8",
    },
  ];

  const CALLOUTS = [
    { at: 5200, text: "Type niche + city", sub: "Restaurants in Lagos" },
    { at: 9000, text: "Live scan", sub: "Results while you search" },
    { at: 12000, text: "Full contact data", sub: "Phone · Email · Address" },
    { at: 14500, text: "127+ leads", sub: "Ready to pitch today" },
  ];

  const TESTIMONIALS = [
    {
      initials: "AO",
      color: C.purple,
      name: "Adewale O.",
      role: "Web Designer, Lagos",
      quote: "Landed 2 clients in one day. Tool paid for itself instantly.",
    },
    {
      initials: "FN",
      color: "#059669",
      name: "Funmilayo N.",
      role: "SMMA Owner, Abuja",
      quote: "4 hours of prospecting now takes 5 minutes.",
    },
    {
      initials: "RM",
      color: "#14B8A6",
      name: "Rotimi M.",
      role: "Social Media Manager",
      quote: "Closed 2 clients from one search. Best ₦30k I spent.",
    },
  ];

  const CITIES = [
    { name: "Lagos", x: -70, y: -90 },
    { name: "Abuja", x: -30, y: -40 },
    { name: "London", x: -150, y: -30 },
    { name: "Dubai", x: 120, y: -50 },
    { name: "New York", x: -160, y: 50 },
    { name: "Nairobi", x: 40, y: 80 },
    { name: "Toronto", x: -120, y: 100 },
  ];

  const FEATURES = [
    "Unlimited searches worldwide",
    "Phone numbers and emails",
    "Live real-time discovery",
    "One-click CSV export",
    "195+ countries covered",
    "All future updates included",
  ];

  const BUSINESS_FULL = "restaurants";
  const LOCATION_FULL = "Lagos, Nigeria";

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function inRange(t, start, end) {
    return t >= start && t < end;
  }
  function localT(t, start) {
    return t - start;
  }
  function typeText(full, local, start, charMs) {
    const n = Math.floor((local - start) / charMs);
    return full.slice(0, clamp(n, 0, full.length));
  }
  function rampCount(local, start, duration, target) {
    const p = clamp((local - start) / duration, 0, 1);
    return Math.floor(easeOutCubic(p) * target);
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function setFont(ctx, size, font, weight = "700") {
    ctx.font = `${weight} ${size}px ${font}`;
  }

  function drawText(ctx, text, x, y, size, color, font, align = "center", weight = "700") {
    ctx.save();
    setFont(ctx, size, font, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawTextEllipsis(ctx, text, x, y, maxW, size, color, font, weight = "500") {
    ctx.save();
    setFont(ctx, size, font, weight);
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    let out = text;
    while (ctx.measureText(out).width > maxW && out.length > 3) {
      out = out.slice(0, -4) + "…";
    }
    ctx.fillText(out, x, y);
    ctx.restore();
  }

  function fillBg(ctx) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawPurpleGlow(ctx, cx, cy, r, pulse = 1) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * pulse);
    g.addColorStop(0, "rgba(124, 58, 237, 0.42)");
    g.addColorStop(0.55, "rgba(124, 58, 237, 0.08)");
    g.addColorStop(1, "rgba(124, 58, 237, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawVignette(ctx) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.9);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawLogo(ctx, cx, cy, size) {
    const s = size;
    roundRect(ctx, cx - s / 2, cy - s / 2, s, s, s * 0.22);
    const lg = ctx.createLinearGradient(cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2);
    lg.addColorStop(0, C.purple);
    lg.addColorStop(1, C.purpleLight);
    ctx.fillStyle = lg;
    ctx.fill();
    drawText(ctx, "LP", cx, cy, s * 0.4, C.white, FONT_HEAD);
  }

  function drawLiveDot(ctx, x, y, pulse) {
    ctx.beginPath();
    ctx.arc(x, y, 6 + pulse * 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(16, 185, 129, ${0.2 * pulse})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = C.green;
    ctx.fill();
  }

  function drawSpinner(ctx, x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = C.purpleLight;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      ctx.globalAlpha = 0.2 + (i / 8) * 0.8;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(r * 1.5, 0);
      ctx.stroke();
      ctx.rotate(Math.PI / 4);
    }
    ctx.restore();
  }

  /** Full LeadThur app UI — matches demo-recording dashboard */
  function drawLeadThurApp(ctx, t, local, opts) {
    const { slideAlpha = 1 } = opts;
    const pad = 36;
    const cardX = pad;
    const cardW = W - pad * 2;

    ctx.save();
    ctx.globalAlpha = slideAlpha;

    const business = typeText(BUSINESS_FULL, local, 800, 55);
    const discovering = local >= 2600;
    const location = discovering ? typeText(LOCATION_FULL, local, 2600, 50) : "";
    const locationTyping = discovering && location.length < LOCATION_FULL.length;

    const rowStart = 3400;
    const rowInterval = 380;
    const rowCount = discovering
      ? clamp(Math.floor((local - rowStart) / rowInterval) + 1, 0, LEADS.length)
      : 0;

    const countStart = 3200;
    const countDuration = 5200;
    const displayCount = discovering
      ? Math.max(rowCount, rampCount(local, countStart, countDuration, TARGET_COUNT))
      : 0;

    const progress = discovering
      ? clamp(((local - countStart) / countDuration) * 100, 0, 100)
      : 0;

    let phaseMsg = null;
    if (local > 2600 && local < 3400) phaseMsg = "Searching for restaurants in Lagos...";
    else if (local > 4000 && rowCount >= 3 && rowCount < LEADS.length)
      phaseMsg = "Matches appearing as we scan…";
    else if (local > 9000 && rowCount >= LEADS.length)
      phaseMsg = `Found ${TARGET_COUNT} businesses — ready to export`;

    let y = 72;

    drawText(ctx, "LeadThur", pad + 8, y, 22, C.purpleLight, FONT_HEAD, "left", "700");
    y += 52;

    roundRect(ctx, cardX, y, cardW, 340, 24);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.strokeStyle = "rgba(124,58,237,0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    let cy = y + 36;
    drawText(ctx, "Discover Prospects", cardX + cardW / 2, cy, 34, C.white, FONT_HEAD);
    cy += 38;
    drawText(
      ctx,
      "Build client lists by niche and location",
      cardX + cardW / 2,
      cy,
      20,
      C.muted,
      FONT_BODY,
      "center",
      "400"
    );
    cy += 44;

    drawText(ctx, "BUSINESS TYPE", cardX + 32, cy, 11, C.muted, FONT_BODY, "left", "600");
    cy += 22;
    roundRect(ctx, cardX + 24, cy, cardW - 48, 52, 12);
    ctx.fillStyle = C.surfaceAlt;
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.stroke();
    drawText(ctx, business || " ", cardX + 40, cy + 26, 22, C.white, FONT_BODY, "left", "500");
    if (local > 600 && local < 2600 && business.length < BUSINESS_FULL.length) {
      setFont(ctx, 22, FONT_BODY, "500");
      const bx = cardX + 40 + ctx.measureText(business).width;
      ctx.fillStyle = C.purpleLight;
      ctx.fillRect(bx, cy + 14, 2, 24);
    }
    cy += 64;

    drawText(ctx, "LOCATION", cardX + 32, cy, 11, C.muted, FONT_BODY, "left", "600");
    cy += 22;
    roundRect(ctx, cardX + 24, cy, cardW - 48, 52, 12);
    ctx.fillStyle = C.surfaceAlt;
    ctx.fill();
    ctx.strokeStyle = locationTyping ? "rgba(16,185,129,0.45)" : C.border;
    ctx.lineWidth = locationTyping ? 2 : 1;
    ctx.stroke();
    drawText(
      ctx,
      location || (discovering ? "" : "Location"),
      cardX + 40,
      cy + 26,
      22,
      location ? C.white : C.muted,
      FONT_BODY,
      "left",
      location ? "500" : "400"
    );
    if (locationTyping) {
      drawText(
        ctx,
        "Scanning — generating results live…",
        cardX + 40,
        cy + 62,
        15,
        C.green,
        FONT_BODY,
        "left",
        "500"
      );
    }
    cy += discovering ? 78 : 64;

    roundRect(ctx, cardX + 24, cy, 200, 48, 12);
    const btnGrad = ctx.createLinearGradient(cardX + 24, cy, cardX + 224, cy + 48);
    btnGrad.addColorStop(0, C.purple);
    btnGrad.addColorStop(1, C.purpleLight);
    ctx.fillStyle = btnGrad;
    ctx.fill();
    if (discovering) {
      drawSpinner(ctx, cardX + 48, cy + 24, 8, local / 80);
      drawText(ctx, "Finding…", cardX + 124, cy + 24, 17, C.white, FONT_BODY, "center", "600");
    } else {
      drawText(ctx, "Find Leads", cardX + 124, cy + 24, 17, C.white, FONT_BODY, "center", "700");
    }

    if (phaseMsg) {
      drawText(ctx, phaseMsg, cardX + 32, cy + 68, 17, C.muted, FONT_BODY, "left", "400");
    }

    y += 360;

    if (discovering) {
      y += 20;
      drawText(ctx, "Live discovery feed", cardX + 8, y, 28, C.white, FONT_HEAD, "left", "800");
      const sub =
        business && location
          ? `${business} · ${location}`
          : `${business} · typing location…`;
      drawText(ctx, sub, cardX + 8, y + 34, 17, C.muted, FONT_BODY, "left", "400");

      const pulse = 0.5 + 0.5 * Math.sin(t / 100);
      drawLiveDot(ctx, cardX + cardW - 280, y + 16, pulse);
      drawText(
        ctx,
        displayCount.toLocaleString(),
        cardX + cardW - 220,
        y + 16,
        26,
        C.green,
        FONT_BODY,
        "left",
        "700"
      );
      drawText(ctx, "businesses found", cardX + cardW - 8, y + 16, 17, C.muted, FONT_BODY, "right", "500");

      y += 56;
      roundRect(ctx, cardX, y, cardW, 10, 5);
      ctx.fillStyle = C.surfaceAlt;
      ctx.fill();
      roundRect(ctx, cardX, y, cardW * (progress / 100), 10, 5);
      ctx.fillStyle = C.purple;
      ctx.fill();
      y += 28;
    }

    const tableY = y;
    const tableH = H - tableY - 48;
    roundRect(ctx, cardX, tableY, cardW, tableH, 20);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.stroke();

    const cols = [
      { label: "BUSINESS NAME", x: cardX + 16, w: 200 },
      { label: "ADDRESS", x: cardX + 220, w: 250 },
      { label: "PHONE", x: cardX + 478, w: 168 },
      { label: "EMAIL", x: cardX + 652, w: 250 },
      { label: "RATING", x: cardX + 910, w: 80 },
    ];

    const headY = tableY + 28;
    cols.forEach((col) => {
      drawText(ctx, col.label, col.x, headY, 10, C.muted, FONT_BODY, "left", "600");
    });

    ctx.strokeStyle = C.border;
    ctx.beginPath();
    ctx.moveTo(cardX + 12, headY + 18);
    ctx.lineTo(cardX + cardW - 12, headY + 18);
    ctx.stroke();

    const rowH = 54;
    const bodyY = headY + 32;

    if (discovering && rowCount === 0 && local > rowStart - 200) {
      drawSpinner(ctx, cardX + cardW / 2, bodyY + 60, 12, local / 70);
      drawText(
        ctx,
        "Scanning map data — first matches incoming…",
        cardX + cardW / 2,
        bodyY + 100,
        17,
        C.muted,
        FONT_BODY,
        "center",
        "400"
      );
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(cardX, bodyY - 4, cardW, tableH - (bodyY - tableY) - 40);
    ctx.clip();

    for (let i = 0; i < rowCount; i++) {
      const lead = LEADS[i];
      const ry = bodyY + i * rowH;
      const rowT = local - (rowStart + i * rowInterval);
      const ra = smoothstep(0, 300, rowT);
      const slide = (1 - easeOutCubic(ra)) * 22;

      if (i % 2 === 0) {
        roundRect(ctx, cardX + 8, ry - 2, cardW - 16, rowH - 4, 6);
        ctx.fillStyle = "rgba(124,58,237,0.06)";
        ctx.globalAlpha = ra;
        ctx.fill();
        ctx.globalAlpha = slideAlpha;
      }

      ctx.globalAlpha = ra * slideAlpha;
      drawTextEllipsis(ctx, lead.name, cols[0].x, ry + 22 - slide, cols[0].w, 17, C.white, FONT_BODY, "600");
      drawTextEllipsis(ctx, lead.address, cols[1].x, ry + 22 - slide, cols[1].w, 14, C.muted, FONT_BODY, "400");
      drawText(ctx, lead.phone, cols[2].x, ry + 22 - slide, 14, C.muted, FONT_BODY, "left", "400");
      drawTextEllipsis(ctx, lead.email, cols[3].x, ry + 22 - slide, cols[3].w, 13, C.email, FONT_BODY, "400");
      drawText(ctx, `★ ${lead.rating}`, cols[4].x, ry + 22 - slide, 15, C.gold, FONT_BODY, "left", "600");
      ctx.globalAlpha = slideAlpha;

      if (scanLine(local, rowStart + i * rowInterval)) {
        const sy = ry + rowH / 2;
        const sg = ctx.createLinearGradient(0, sy - 30, 0, sy + 30);
        sg.addColorStop(0, "rgba(124,58,237,0)");
        sg.addColorStop(0.5, "rgba(124,58,237,0.35)");
        sg.addColorStop(1, "rgba(124,58,237,0)");
        ctx.fillStyle = sg;
        ctx.fillRect(cardX + 8, sy - 30, cardW - 16, 60);
      }
    }

    ctx.restore();

    if (rowCount > 0) {
      drawText(
        ctx,
        `Showing ${rowCount} of ${TARGET_COUNT} prospects`,
        cardX + 20,
        tableY + tableH - 28,
        14,
        C.muted,
        FONT_BODY,
        "left",
        "400"
      );
    }

    ctx.restore();
  }

  function scanLine(local, rowAppear) {
    if (local < rowAppear || local > rowAppear + 600) return false;
    return true;
  }

  function drawCallout(ctx, text, sub, alpha, y) {
    ctx.globalAlpha = alpha;
    roundRect(ctx, 40, y, W - 80, 88, 16);
    ctx.fillStyle = "rgba(15,15,20,0.94)";
    ctx.fill();
    ctx.fillStyle = C.purple;
    ctx.fillRect(40, y, 5, 88);
    drawText(ctx, text, 72, y + 30, 24, C.white, FONT_BODY, "left", "700");
    drawText(ctx, sub, 72, y + 58, 17, C.muted, FONT_BODY, "left", "400");
    ctx.globalAlpha = 1;
  }

  function sceneIntro(ctx, t) {
    const local = localT(t, T.intro[0]);
    ctx.fillStyle = local < 400 ? C.black : C.bg;
    ctx.fillRect(0, 0, W, H);

    const fadeIn = smoothstep(0, 700, local);
    const fadeOut = local > 2200 ? smoothstep(2200, 3000, local) : 0;
    const a = fadeIn * (1 - fadeOut);
    if (a <= 0) return;

    ctx.globalAlpha = a;
    drawPurpleGlow(ctx, W / 2, H * 0.36, 300, 1 + 0.1 * Math.sin(local / 380));
    drawLogo(ctx, W / 2, H * 0.33, 120);

    const brand = "LeadThur";
    const letters = Math.floor(smoothstep(500, 1600, local) * brand.length);
    drawText(ctx, brand.slice(0, letters), W / 2, H * 0.33 + 100, 64, C.white, FONT_HEAD);

    const tagA = smoothstep(1300, 1900, local);
    ctx.globalAlpha = a * tagA;
    drawText(
      ctx,
      "Find Businesses To Pitch In Seconds",
      W / 2,
      H * 0.33 + 175,
      28,
      C.muted,
      FONT_BODY,
      "center",
      "400"
    );
    ctx.globalAlpha = 1;
  }

  function scenePain(ctx, t) {
    fillBg(ctx);
    drawPurpleGlow(ctx, W / 2, 100, 240, 1.08);
    const local = localT(t, T.pain[0]);

    const lines = ["Still searching", "Google manually", "for clients?"];
    lines.forEach((line, i) => {
      const lt = local - i * 650;
      if (lt < 0) return;
      const enter = easeOutBack(smoothstep(0, 400, lt));
      const slideOut = local > 3800 ? smoothstep(3800, 4500, local) : 0;
      const y = H * 0.26 + i * 96 - (1 - enter) * 80;
      ctx.globalAlpha = smoothstep(0, 350, lt) * (1 - slideOut);
      drawText(ctx, line, W / 2, y, 68, C.white, FONT_HEAD, "center", "800");
      ctx.globalAlpha = 1;
    });

    if (local > 2200 && local < 4600) {
      const ca = smoothstep(2200, 2600, local) * (1 - smoothstep(4000, 4500, local));
      ctx.globalAlpha = ca;
      const cy = H * 0.56;
      ctx.strokeStyle = C.red;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(W / 2, cy, 48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(W / 2 - 32, cy - 32);
      ctx.lineTo(W / 2 + 32, cy + 32);
      ctx.stroke();
      drawText(
        ctx,
        "Hours wasted copying contacts from Google Maps",
        W / 2,
        H * 0.66,
        24,
        C.muted,
        FONT_BODY,
        "center",
        "400"
      );
      ctx.globalAlpha = 1;
    }
  }

  function sceneProduct(ctx, t) {
    fillBg(ctx);
    drawPurpleGlow(ctx, W / 2, H * 0.45, 400, 1);
    const local = localT(t, T.product[0]);
    const slideIn = easeOutCubic(smoothstep(0, 600, local));
    const slideOut = local > 14800 ? easeOutCubic(smoothstep(14800, 15500, local)) : 0;

    drawLeadThurApp(ctx, t, local, { slideAlpha: slideIn * (1 - slideOut) });

    CALLOUTS.forEach((c) => {
      const ca =
        smoothstep(c.at, c.at + 350, local) *
        (1 - smoothstep(c.at + 1600, c.at + 2000, local));
      if (ca <= 0) return;
      drawCallout(ctx, c.text, c.sub, ca * slideIn * (1 - slideOut), H - 132);
    });

    if (local > 400 && local < 2000) {
      const ta = smoothstep(400, 800, local) * (1 - smoothstep(1600, 2000, local));
      drawText(ctx, "How LeadThur works", W / 2, 36, 22, C.purpleLight, FONT_BODY, "center", "600");
      ctx.globalAlpha = ta;
    }
  }

  function sceneExport(ctx, t) {
    fillBg(ctx);
    const local = localT(t, T.export[0]);
    const fade = smoothstep(0, 400, local);

    drawLeadThurApp(ctx, t, 12000, { slideAlpha: 1 });

    const pad = 36;
    const cardX = pad;
    const cardW = W - pad * 2;
    const btnY = H - 200;

    const exportGlow = smoothstep(300, 900, local);
    if (exportGlow > 0) {
      ctx.shadowColor = C.purple;
      ctx.shadowBlur = 30 * exportGlow;
      roundRect(ctx, cardX + 24, btnY, cardW - 48, 56, 14);
      ctx.fillStyle = C.purple;
      ctx.fill();
      ctx.shadowBlur = 0;
      drawText(ctx, "Export CSV", cardX + cardW / 2, btnY + 28, 20, C.white, FONT_BODY, "center", "700");
      drawText(
        ctx,
        `${TARGET_COUNT} leads · phones & emails included`,
        cardX + cardW / 2,
        btnY - 24,
        16,
        C.muted,
        FONT_BODY,
        "center",
        "400"
      );
    }

    if (local > 1400 && local < 2800) {
      const rippleT = (local - 1400) / 700;
      if (rippleT < 1) {
        const rx = cardX + cardW / 2;
        const ry = btnY + 28;
        ctx.globalAlpha = (1 - rippleT) * 0.6;
        ctx.strokeStyle = C.purpleLight;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(rx, ry, 20 + rippleT * 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    if (local > 2000) {
      const ca = smoothstep(2000, 2400, local) * (1 - smoothstep(3600, 4000, local));
      ctx.globalAlpha = ca * fade;
      roundRect(ctx, W / 2 - 280, H * 0.38, 560, 240, 28);
      ctx.fillStyle = "rgba(15,15,20,0.97)";
      ctx.fill();
      ctx.strokeStyle = "rgba(16,185,129,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();

      const sc = easeOutBack(smoothstep(2000, 2600, local));
      ctx.save();
      ctx.translate(W / 2, H * 0.4);
      ctx.scale(sc, sc);
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-55, 0);
      ctx.lineTo(-15, 45);
      ctx.lineTo(60, -42);
      ctx.stroke();
      ctx.restore();

      drawText(ctx, "CSV Downloaded", W / 2, H * 0.48, 38, C.white, FONT_HEAD);
      drawText(
        ctx,
        `${TARGET_COUNT} businesses ready for outreach`,
        W / 2,
        H * 0.52,
        20,
        C.muted,
        FONT_BODY,
        "center",
        "400"
      );
      ctx.globalAlpha = 1;
    }
  }

  function drawStars(ctx, x, y) {
    for (let i = 0; i < 5; i++) {
      drawText(ctx, "★", x + i * 30, y, 24, C.gold, FONT_BODY, "left");
    }
  }

  function sceneSocial(ctx, t) {
    fillBg(ctx);
    drawPurpleGlow(ctx, W / 2, H / 2, 300, 1);
    const local = localT(t, T.social[0]);
    const cardW = 920;
    const cardH = 260;
    const cardX = (W - cardW) / 2;
    const groupFade = local > 5200 ? smoothstep(5200, 5800, local) : 0;

    TESTIMONIALS.forEach((card, i) => {
      const slotStart = i * 1800;
      const ct = local - slotStart;
      if (ct < -200 || ct > 2200) return;
      const enter = easeOutCubic(smoothstep(0, 450, ct));
      const exit = ct > 1500 ? smoothstep(1500, 1900, ct) : 0;
      const x = lerp(W + 50, cardX, enter) - exit * (W + cardW) - groupFade * (W + cardW);
      const y = H * 0.36;

      ctx.globalAlpha = enter * (1 - exit) * (1 - groupFade);
      roundRect(ctx, x, y, cardW, cardH, 24);
      ctx.fillStyle = C.surface;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 72, y + cardH / 2, 44, 0, Math.PI * 2);
      ctx.fillStyle = card.color;
      ctx.fill();
      drawText(ctx, card.initials, x + 72, y + cardH / 2, 26, C.white, FONT_HEAD);
      drawText(ctx, card.name, x + 140, y + 56, 28, C.white, FONT_BODY, "left", "600");
      drawText(ctx, card.role, x + 140, y + 92, 20, C.muted, FONT_BODY, "left", "400");
      drawStars(ctx, x + 140, y + 128);
      drawText(ctx, `"${card.quote}"`, x + 140, y + 185, 24, C.white, FONT_BODY, "left", "400");
      ctx.globalAlpha = 1;
    });
  }

  function sceneWorld(ctx, t) {
    fillBg(ctx);
    const local = localT(t, T.world[0]);
    const fade = smoothstep(0, 400, local) * (1 - smoothstep(3600, 4000, local));
    ctx.globalAlpha = fade;
    drawPurpleGlow(ctx, W / 2, H * 0.55, 350, 1.05);

    ["Any business.", "Any city.", "Anywhere."].forEach((line, i) => {
      const wa = smoothstep(i * 350, i * 350 + 400, local);
      if (wa <= 0) return;
      ctx.globalAlpha = fade * wa;
      drawText(ctx, line, W / 2, H * 0.1 + i * 68, 52, C.white, FONT_HEAD, "center", "800");
    });
    ctx.globalAlpha = fade;

    const cx = W / 2;
    const cy = H * 0.55;
    ctx.strokeStyle = C.purple;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 200, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 200 * Math.abs(Math.cos(a)), 200, a, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy, 200, 110, 0, 0, Math.PI * 2);
    ctx.stroke();

    CITIES.forEach((city, i) => {
      const ca = smoothstep(700 + i * 300, 700 + i * 300 + 350, local);
      if (ca <= 0) return;
      const px = cx + city.x;
      const py = cy + city.y;
      ctx.globalAlpha = fade * ca * 0.45;
      ctx.strokeStyle = C.purpleLight;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(0.5 + 0.5 * easeOutBack(ca), 0.5 + 0.5 * easeOutBack(ca));
      setFont(ctx, 17, FONT_BODY, "600");
      const tw = ctx.measureText(city.name).width + 36;
      roundRect(ctx, -tw / 2, -20, tw, 40, 20);
      ctx.fillStyle = C.purple;
      ctx.fill();
      drawText(ctx, city.name, 0, 0, 17, C.white, FONT_BODY, "center", "600");
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  function scenePricing(ctx, t) {
    fillBg(ctx);
    drawPurpleGlow(ctx, W / 2, H / 2, 420, 1.06);
    const local = localT(t, T.pricing[0]);
    const fade = smoothstep(0, 350, local) * (1 - smoothstep(3600, 4000, local));
    ctx.globalAlpha = fade;

    const cw = 940;
    const ch = 1180;
    const cx = (W - cw) / 2;
    const cy = (H - ch) / 2;

    roundRect(ctx, cx, cy, cw, ch, 32);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.strokeStyle = "rgba(124,58,237,0.55)";
    ctx.lineWidth = 2;
    ctx.shadowColor = C.purple;
    ctx.shadowBlur = 40;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const step = (i) => smoothstep(i * 280, i * 280 + 320, local);
    let y = cy + 56;

    if (step(0) > 0) {
      roundRect(ctx, W / 2 - 115, y, 230, 42, 21);
      ctx.fillStyle = C.purple;
      ctx.fill();
      drawText(ctx, "LIFETIME ACCESS", W / 2, y + 21, 17, C.white, FONT_BODY, "center", "700");
      y += 78;
    }
    if (step(1) > 0) {
      drawText(ctx, "LeadThur", W / 2, y, 54, C.white, FONT_HEAD);
      y += 72;
    }
    if (step(2) > 0) {
      const strikeP = smoothstep(1600, 2200, local);
      if (strikeP < 1) {
        drawText(ctx, "₦90,000", W / 2, y, 68, "rgba(244,244,255,0.3)", FONT_HEAD);
        setFont(ctx, 68, FONT_HEAD, "700");
        const sw = ctx.measureText("₦90,000").width;
        ctx.strokeStyle = C.red;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(W / 2 - sw / 2, y);
        ctx.lineTo(W / 2 - sw / 2 + sw * strikeP, y);
        ctx.stroke();
      }
      if (smoothstep(2000, 2500, local) > 0) {
        drawText(ctx, "₦30,000", W / 2, y, 96, C.white, FONT_HEAD);
      }
      y += 108;
    }
    if (step(3) > 0) {
      drawText(ctx, "One payment. No monthly fee. No renewal.", W / 2, y, 24, C.muted, FONT_BODY, "center", "400");
      y += 56;
    }

    FEATURES.forEach((feat, i) => {
      const fa = smoothstep(1100 + i * 240, 1100 + i * 240 + 260, local);
      if (fa <= 0) return;
      const fy = y + i * 48;
      ctx.globalAlpha = fade * fa;
      ctx.beginPath();
      ctx.arc(cx + 58, fy, 14, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(16,185,129,0.15)";
      ctx.fill();
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + 52, fy);
      ctx.lineTo(cx + 56, fy + 5);
      ctx.lineTo(cx + 66, fy - 6);
      ctx.stroke();
      drawText(ctx, feat, cx + 88, fy, 23, C.white, FONT_BODY, "left", "400");
      ctx.globalAlpha = fade;
    });

    const btnY = cy + ch - 88;
    if (smoothstep(2800, 3100, local) > 0) {
      roundRect(ctx, cx + 36, btnY, cw - 72, 68, 18);
      ctx.fillStyle = C.purple;
      ctx.fill();
      const shimmerX = ((local / 35) % (cw - 72)) - 100;
      const sg = ctx.createLinearGradient(cx + 36 + shimmerX, btnY, cx + 36 + shimmerX + 220, btnY);
      sg.addColorStop(0, "rgba(255,255,255,0)");
      sg.addColorStop(0.5, "rgba(255,255,255,0.28)");
      sg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sg;
      ctx.fill();
      drawText(ctx, "Get Lifetime Access — ₦30,000", W / 2, btnY + 34, 24, C.white, FONT_BODY, "center", "700");
    }
    ctx.globalAlpha = 1;
  }

  function sceneClose(ctx, t) {
    const local = localT(t, T.close[0]);
    ctx.fillStyle = local < 400 ? C.black : C.bg;
    ctx.fillRect(0, 0, W, H);

    const fadeIn = smoothstep(300, 1000, local);
    const fadeOut = local > 3700 ? smoothstep(3700, 4000, local) : 0;
    const a = fadeIn * (1 - fadeOut);

    ctx.globalAlpha = a;
    drawPurpleGlow(ctx, W / 2, H * 0.38, 260, 1);
    drawLogo(ctx, W / 2, H * 0.3, 120);

    ["Stop searching.", "Start closing."].forEach((line, i) => {
      const la = smoothstep(600 + i * 350, 600 + i * 350 + 450, local);
      ctx.globalAlpha = a * la;
      drawText(ctx, line, W / 2, H * 0.46 + i * 78, 64, C.white, FONT_HEAD, "center", "800");
    });

    ctx.globalAlpha = a * smoothstep(1400, 1900, local);
    drawText(
      ctx,
      "Find clients in seconds. Worldwide.",
      W / 2,
      H * 0.62,
      28,
      C.muted,
      FONT_BODY,
      "center",
      "400"
    );

    drawText(ctx, "↓", W / 2, H * 0.74 + 14 * Math.sin(local / 260), 52, C.purpleLight, FONT_HEAD);
    ctx.globalAlpha = 1;

    if (local > 3900) {
      ctx.fillStyle = C.black;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function renderFrame(ctx, tMs) {
    const t = clamp(tMs, 0, DURATION_MS);
    ctx.clearRect(0, 0, W, H);

    if (inRange(t, ...T.intro)) sceneIntro(ctx, t);
    else if (inRange(t, ...T.pain)) scenePain(ctx, t);
    else if (inRange(t, ...T.product)) sceneProduct(ctx, t);
    else if (inRange(t, ...T.export)) sceneExport(ctx, t);
    else if (inRange(t, ...T.social)) sceneSocial(ctx, t);
    else if (inRange(t, ...T.world)) sceneWorld(ctx, t);
    else if (inRange(t, ...T.pricing)) scenePricing(ctx, t);
    else sceneClose(ctx, t);

    drawVignette(ctx);
  }

  async function loadFonts() {
    const specs = [
      "400 28px Figtree",
      "500 26px Figtree",
      "600 20px Figtree",
      '700 48px "Bricolage Grotesque"',
      '800 64px "Bricolage Grotesque"',
      '800 72px "Bricolage Grotesque"',
      '800 96px "Bricolage Grotesque"',
    ];
    await Promise.all(specs.map((s) => document.fonts.load(s)));
    await document.fonts.ready;
  }

  global.LeadThurCanvasAd = {
    W,
    H,
    DURATION_MS,
    FPS,
    loadFonts,
    renderFrame,
  };
})(window);
