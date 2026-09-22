/* ============ LEGAL PAGES: "ON THIS PAGE" NAVIGATION ============
   One component shared by the Terms of Use, Privacy Policy and Refund Policy
   pages. Markup it expects:

     <div class="lg-wrap" data-legal>
       <div class="lg-toc-slot"><nav class="lg-toc"> <h2/> <ol/> </nav></div>
       <article class="lg-body"> <section class="lg-sec" id="…"><h2>…</h2> … </article>
     </div>

   - The list is rebuilt from the page's own section headings, so it can never
     drift out of sync with the content (the static list in the HTML is only
     the no-JavaScript fallback).
   - Desktop / tablet (min-width 900px, min-height 560px): the article is the
     scroll container; the rail is the frame's other column.
   - Phones: normal page flow; the rail is a disclosure that docks to the
     bottom of the screen while the policy is on screen.
   - The section being read is detected with IntersectionObserver (no work on
     every scroll event): a reading band across the top of the scroller (24px
     down to 30%); the first section inside it wins, so only one item is ever
     active and nothing flickers between two partly visible sections. */
(function () {
  "use strict";

  var wrap = document.querySelector("[data-legal]");
  if (!wrap) return;
  var toc = wrap.querySelector(".lg-toc"),
    list = toc.querySelector("ol"),
    slot = wrap.querySelector(".lg-toc-slot"),
    body = wrap.querySelector(".lg-body");
  var secs = [].slice.call(body.querySelectorAll(".lg-sec[id]"));
  if (!secs.length || !("IntersectionObserver" in window)) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BEH = reduced ? "instant" : "smooth";
  var mq = window.matchMedia("(min-width: 900px) and (min-height: 560px)");
  var desk = frameLive(); /* the stylesheet decides; the media query only signals a change */
  var GAP = 18; /* the frame's distance from the top of the window */

  /* ---- 1. build the list from the headings ---- */
  list.id = list.id || "lg-toc-list";
  list.innerHTML = "";
  var links = secs.map(function (s, i) {
    var h = s.querySelector("h2"), n = h.querySelector(".lg-n");
    var num = n ? n.textContent.replace(/\D/g, "") : "";
    num = num || String(i + 1);
    var title = h.textContent.replace(n ? n.textContent : "", "").trim();
    var li = document.createElement("li"), a = document.createElement("a"), sp = document.createElement("span");
    sp.textContent = num.length < 2 ? "0" + num : num;
    a.href = "#" + s.id;
    a.appendChild(sp);
    a.appendChild(document.createTextNode(title));
    li.appendChild(a);
    list.appendChild(li);
    if (!s.hasAttribute("tabindex")) s.setAttribute("tabindex", "-1");
    return a;
  });

  /* the phone disclosure button */
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "lg-toc-btn";
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", list.id);
  btn.innerHTML = '<span class="lab">On this page</span><span class="cur"></span>' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  toc.insertBefore(btn, list);
  toc.classList.add("js");
  var cur = btn.querySelector(".cur");

  /* the scrolling article is a keyboard-focusable region on desktop */
  if (!body.hasAttribute("tabindex")) body.setAttribute("tabindex", "0");
  if (!body.hasAttribute("role")) body.setAttribute("role", "region");

  /* ---- 2. the active item ---- */
  var active = -1;
  function setActive(i) {
    if (i < 0 || i === active) return;
    if (active >= 0) { links[active].classList.remove("on"); links[active].removeAttribute("aria-current"); }
    active = i;
    links[i].classList.add("on");
    links[i].setAttribute("aria-current", "location");
    cur.innerHTML = "";
    var sp = document.createElement("span"), em = document.createElement("em");
    sp.textContent = links[i].firstChild.textContent;
    em.textContent = links[i].lastChild.textContent;
    cur.appendChild(sp);
    cur.appendChild(em);
    reveal(links[i], true);
  }

  /* keep the active item inside the rail's own scroll area; scrolls only the
     list, never the page */
  function reveal(a, smooth) {
    if (list.scrollHeight <= list.clientHeight + 1 || !list.offsetParent) return;
    var top = a.offsetTop, bot = top + a.offsetHeight, pad = 12;
    if (top >= list.scrollTop + pad && bot <= list.scrollTop + list.clientHeight - pad) return;
    list.scrollTo({ top: Math.max(0, top - list.clientHeight / 2 + a.offsetHeight / 2), behavior: smooth ? BEH : "instant" });
  }

  /* ---- 3. which section is being read ---- */
  var hits = {}, io = null, lock = false;
  /* the layout itself says which mode is live: is the article a scroller? */
  function frameLive() { return getComputedStyle(body).overflowY !== "visible"; }
  function pick() {
    for (var i = 0; i < secs.length; i++) if (hits[secs[i].id]) return i;
    /* nothing inside the band (e.g. at the very top, where the intro sits
       above section 1): the last section that has started above the band's
       lower edge. Measured only in this case, never per scroll event. */
    var top = desk ? body.getBoundingClientRect().top : 0;
    var line = top + (desk ? body.clientHeight : window.innerHeight) * 0.3, k = 0;
    for (var j = 0; j < secs.length; j++) if (secs[j].getBoundingClientRect().top < line) k = j;
    return k;
  }
  function observe() {
    if (io) io.disconnect();
    hits = {};
    io = new IntersectionObserver(function (es) {
      /* crossing the breakpoint, the old observer can report against the new
         layout before the media-query change arrives (matchMedia is stale at
         that moment too): ignore it until the mode has switched */
      if (frameLive() !== desk) return;
      es.forEach(function (e) { hits[e.target.id] = e.isIntersecting; });
      if (!lock) setActive(pick());
    /* the band starts just below the point a heading is aligned to (16px),
       so the tail of the previous section never competes with it */
    }, { root: desk ? body : null, rootMargin: "-24px 0px -70% 0px", threshold: 0 });
    secs.forEach(function (s) { io.observe(s); });
  }

  /* ---- 4. room at the end, so the last sections can reach the top ---- */
  var end = document.createElement("div");
  end.className = "lg-end";
  end.setAttribute("aria-hidden", "true");
  body.appendChild(end);
  /* measured without collapsing the spacer first (that could clamp the
     reader's scroll position), and written only when the value changes */
  function sizeEnd() {
    var h = 0;
    if (desk) {
      var last = secs[secs.length - 1];
      var after = body.scrollHeight - end.offsetHeight - last.offsetTop;
      h = Math.max(0, Math.round(body.clientHeight - after - 16));
    }
    if (end.offsetHeight !== h) end.style.height = h + "px";
  }
  var sizeRaf = 0;
  function sizeEndSoon() {
    if (!sizeRaf) sizeRaf = requestAnimationFrame(function () { sizeRaf = 0; sizeEnd(); });
  }

  /* ---- 5. going to a section ---- */
  /* while a clicked scroll is travelling, the rail holds the clicked item
     (no stepping through the sections it passes); it resumes following the
     text once the scroll has actually stopped */
  var unlockT = 0, capT = 0, pending = null;
  function unlockSoon(scroller) {
    if (pending) pending();
    /* these listeners exist only while a clicked scroll is in flight */
    function quiet() { clearTimeout(unlockT); unlockT = setTimeout(done, 180); }
    function cleanup() {
      clearTimeout(unlockT); clearTimeout(capT);
      scroller.removeEventListener("scroll", quiet);
      scroller.removeEventListener("scrollend", done);
      pending = null;
    }
    function done() { cleanup(); lock = false; setActive(pick()); }
    pending = cleanup;
    scroller.addEventListener("scroll", quiet, { passive: true });
    scroller.addEventListener("scrollend", done); /* where supported: prompt */
    unlockT = setTimeout(done, reduced ? 80 : 400); /* nothing needed scrolling */
    capT = setTimeout(done, 3000);                  /* safety net */
  }

  /* bring the whole reading frame into view (desktop) */
  function frameTop() { return window.scrollY + wrap.getBoundingClientRect().top - GAP; }
  function alignFrame(beh) {
    if (Math.abs(wrap.getBoundingClientRect().top - GAP) > 2) window.scrollTo({ top: frameTop(), behavior: beh });
  }

  function go(i, focus, beh) {
    beh = beh || BEH;
    var s = secs[i];
    lock = true;
    setActive(i);
    if (desk) {
      alignFrame(beh);
      body.scrollTo({ top: Math.max(0, s.offsetTop - 16), behavior: beh });
      unlockSoon(body);
    } else {
      window.scrollTo({ top: window.scrollY + s.getBoundingClientRect().top - 16, behavior: beh });
      unlockSoon(window);
    }
    if (focus) s.focus({ preventScroll: true });
    if (history.replaceState) history.replaceState(null, "", "#" + s.id);
  }

  function indexOf(id) {
    for (var i = 0; i < secs.length; i++) if (secs[i].id === id) return i;
    return -1;
  }

  /* every in-page link to a section (the rail, and links inside the text)
     and the hero's "read" button go through the same path */
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var id = decodeURIComponent(a.getAttribute("href").slice(1)), i = indexOf(id);
    if (i >= 0) {
      e.preventDefault();
      go(i, true);
      if (!desk) setOpen(false);
    } else if (id === "policy") {
      e.preventDefault();
      if (desk) alignFrame(BEH);
      else window.scrollTo({ top: window.scrollY + slot.getBoundingClientRect().top - 16, behavior: BEH });
    }
  });

  /* ---- 6. phones: the disclosure and the dock ---- */
  function setOpen(o) {
    toc.classList.toggle("open", o);
    btn.setAttribute("aria-expanded", o ? "true" : "false");
    if (o && active >= 0) requestAnimationFrame(function () { reveal(links[active], false); });
  }
  btn.addEventListener("click", function () { setOpen(!toc.classList.contains("open")); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && toc.classList.contains("open")) { setOpen(false); btn.focus(); }
  });
  document.addEventListener("pointerdown", function (e) {
    if (toc.classList.contains("dock") && toc.classList.contains("open") && !toc.contains(e.target)) setOpen(false);
  });

  var slotIn = true, bodyIn = false, reading = false;
  /* the bar is fixed, but it lives inside the policy section's stacking
     context (z-index 2), so later sections at the same level would paint over
     it and swallow taps; while docked, the section is lifted above them */
  var host = wrap.closest("section") || wrap;
  function applyDock() {
    var d = !desk && !slotIn && bodyIn;
    host.classList.toggle("lg-docked", d);
    if (d === toc.classList.contains("dock")) return;
    if (d) slot.style.minHeight = slot.offsetHeight + "px"; /* hold its place: no layout shift */
    else slot.style.minHeight = "";
    setOpen(false);
    toc.classList.toggle("dock", d);
  }
  new IntersectionObserver(function (es) { slotIn = es[es.length - 1].isIntersecting; applyDock(); }).observe(slot);
  new IntersectionObserver(function (es) {
    bodyIn = es[es.length - 1].isIntersecting;
    if (frameLive() === desk) reading = bodyIn; /* a snapshot the mode switch can trust */
    applyDock();
  }, { rootMargin: "0px 0px -45% 0px" }).observe(body);

  /* ---- 7. desktop: settle the frame when the reader scrolls toward it ----
     Runs once when a page scroll ends (not on every scroll event): if the
     frame has come most of the way into view in the direction of travel, it
     eases the last few pixels so the whole frame is visible. Leaving the
     frame (scrolling on toward the hero or the footer) is never pulled back. */
  var lastY = window.scrollY, settleT = 0;
  function settle() {
    var y = window.scrollY, dir = y - lastY;
    lastY = y;
    if (!desk || reduced || lock || !dir) return;
    var t = wrap.getBoundingClientRect().top - GAP, band = window.innerHeight * 0.3;
    if ((dir > 0 && t > 2 && t < band) || (dir < 0 && t < -2 && t > -band)) window.scrollTo({ top: y + t, behavior: "smooth" });
  }
  if ("onscrollend" in window) window.addEventListener("scrollend", settle);
  else window.addEventListener("scroll", function () { clearTimeout(settleT); settleT = setTimeout(settle, 140); }, { passive: true });

  /* ---- 8. mode changes and resizing ---- */
  function setMode() {
    var keep = active, wasReading = reading;
    desk = frameLive();
    setOpen(false);
    toc.classList.remove("dock");
    host.classList.remove("lg-docked");
    slot.style.minHeight = "";
    lock = true;
    requestAnimationFrame(function () {
      sizeEnd();
      observe();
      /* carry the section being read across the switch; someone looking at
         the hero while resizing is left exactly where they are */
      if (wasReading && keep >= 0) {
        var s = secs[keep];
        if (desk) {
          alignFrame("instant");
          body.scrollTop = Math.max(0, s.offsetTop - 16);
        } else {
          window.scrollTo({ top: window.scrollY + s.getBoundingClientRect().top - 16, behavior: "instant" });
        }
      }
      lock = false;
    });
  }
  if (mq.addEventListener) mq.addEventListener("change", setMode);
  else mq.addListener(setMode);
  if ("ResizeObserver" in window) {
    var ro = new ResizeObserver(sizeEndSoon);
    ro.observe(body);
    ro.observe(secs[secs.length - 1]);
  } else window.addEventListener("resize", sizeEndSoon, { passive: true });

  /* ---- start ---- */
  sizeEnd();
  observe();
  setActive(0);
  var start = indexOf(decodeURIComponent(location.hash.slice(1)));
  if (start >= 0) requestAnimationFrame(function () { go(start, false, "instant"); });
})();
