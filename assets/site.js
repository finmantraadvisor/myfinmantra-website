/* MyFinMantra — site scripts (no external libraries) */
(function () {
  "use strict";
  var WA = "919711899555";
  var inr = function (n) { return "₹" + Math.round(n).toLocaleString("en-IN"); };
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* Mobile menu */
  var tg = $(".menu-toggle"), menu = $(".menu");
  if (tg && menu) tg.addEventListener("click", function () {
    var open = menu.classList.toggle("open");
    tg.setAttribute("aria-expanded", open ? "true" : "false");
  });

  /* Footer year */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Compliance due dates ---------- */
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function events(from, days) {
    var out = [], end = new Date(from.getTime() + days * 864e5);
    for (var y = from.getFullYear(); y <= end.getFullYear(); y++) {
      for (var m = 0; m < 12; m++) {
        var qAfter = (m === 0 || m === 3 || m === 6 || m === 9); // month after a quarter ends
        var tdsDay = (m === 3) ? 30 : 7;
        out.push({ d: new Date(y, m, tdsDay), what: "TDS / TCS deposit", who: "Tax deducted in " + MON[(m + 11) % 12] });
        out.push({ d: new Date(y, m, 11), what: "GSTR-1 (monthly filers)", who: "Outward supplies for " + MON[(m + 11) % 12] });
        if (qAfter) out.push({ d: new Date(y, m, 13), what: "GSTR-1 (QRMP filers)", who: "Quarterly outward supplies" });
        out.push({ d: new Date(y, m, 15), what: "PF & ESI contributions", who: "For salaries of " + MON[(m + 11) % 12] });
        out.push({ d: new Date(y, m, 20), what: "GSTR-3B (monthly filers)", who: "Summary return & tax payment" });
        if (qAfter) out.push({ d: new Date(y, m, 24), what: "GSTR-3B (QRMP, Haryana & northern states)", who: "Quarterly return; 22nd in some states" });
        else out.push({ d: new Date(y, m, 25), what: "GST PMT-06 (QRMP filers)", who: "Monthly tax payment" });
      }
      out.push({ d: new Date(y, 0, 31), what: "TDS statements, Q3", who: "Oct–Dec quarter" });
      out.push({ d: new Date(y, 4, 31), what: "TDS statements, Q4", who: "Jan–Mar quarter" });
      out.push({ d: new Date(y, 6, 31), what: "TDS statements, Q1", who: "Apr–Jun quarter" });
      out.push({ d: new Date(y, 9, 31), what: "TDS statements, Q2", who: "Jul–Sep quarter" });
      out.push({ d: new Date(y, 5, 15), what: "Advance tax, 1st instalment", who: "15% of estimated tax" });
      out.push({ d: new Date(y, 8, 15), what: "Advance tax, 2nd instalment", who: "45% cumulative" });
      out.push({ d: new Date(y, 11, 15), what: "Advance tax, 3rd instalment", who: "75% cumulative" });
      out.push({ d: new Date(y, 2, 15), what: "Advance tax, final instalment", who: "100% cumulative" });
      out.push({ d: new Date(y, 11, 31), what: "GSTR-9 annual return", who: "For the previous financial year" });
    }
    return out.filter(function (e) { return e.d >= from && e.d <= end; })
              .sort(function (a, b) { return a.d - b.d; });
  }
  $$("[data-due]").forEach(function (box) {
    var n = parseInt(box.getAttribute("data-due"), 10) || 5;
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var list = events(t, 75).slice(0, n);
    box.innerHTML = list.map(function (e) {
      var diff = Math.round((e.d - t) / 864e5);
      var when = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : "In " + diff + " days";
      return '<li class="' + (diff <= 3 ? "soon" : "") + '"><span class="d"><b>' + e.d.getDate() +
        '</b><i>' + MON[e.d.getMonth()] + '</i></span><span class="what">' + e.what +
        '<span class="who">' + e.who + " · " + when + "</span></span></li>";
    }).join("");
  });

  /* ---------- GST calculator ---------- */
  var gst = $("#gst-form");
  if (gst) {
    var runGst = function () {
      var amt = parseFloat($("#gst-amt").value) || 0;
      var rate = parseFloat($("#gst-rate").value) || 0;
      var mode = $("input[name=gst-mode]:checked", gst).value;
      var inter = $("input[name=gst-supply]:checked", gst).value === "inter";
      var base, tax;
      if (mode === "add") { base = amt; tax = amt * rate / 100; }
      else { base = amt * 100 / (100 + rate); tax = amt - base; }
      var r = $("#gst-out"), split = inter
        ? "<dt>IGST @ " + rate + "%</dt><dd>" + inr2(tax) + "</dd>"
        : "<dt>CGST @ " + rate / 2 + "%</dt><dd>" + inr2(tax / 2) + "</dd><dt>SGST @ " + rate / 2 + "%</dt><dd>" + inr2(tax / 2) + "</dd>";
      r.innerHTML = "<dl><dt>Taxable value</dt><dd>" + inr2(base) + "</dd>" + split +
        '<dt class="total">Invoice total</dt><dd class="total">' + inr2(base + tax) + "</dd></dl>";
    };
    gst.addEventListener("input", runGst); runGst();
  }
  function inr2(n) { return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  /* ---------- Income tax: new vs old regime (resident individual) ---------- */
  function slabTax(ti, slabs) {
    var tax = 0, prev = 0;
    for (var i = 0; i < slabs.length; i++) {
      var top = slabs[i][0], rate = slabs[i][1];
      if (ti > prev) tax += (Math.min(ti, top) - prev) * rate;
      prev = top;
    }
    return tax;
  }
  function surcharge(ti, tax, capped) {
    var r = ti > 5e7 ? (capped ? .25 : .37) : ti > 2e7 ? .25 : ti > 1e7 ? .15 : ti > 5e6 ? .10 : 0;
    return tax * r;
  }
  function newRegime(ti) {
    var tax = slabTax(ti, [[4e5,0],[8e5,.05],[12e5,.10],[16e5,.15],[2e6,.20],[24e5,.25],[Infinity,.30]]);
    if (ti <= 12e5) tax = 0;                               // s.87A rebate up to ₹60,000
    else if (tax > ti - 12e5) tax = ti - 12e5;            // marginal relief just above ₹12 lakh
    var sc = surcharge(ti, tax, true);
    return { tax: tax, sc: sc, cess: (tax + sc) * .04 };
  }
  function oldRegime(ti, age) {
    var ex = age === "80" ? 5e5 : age === "60" ? 3e5 : 2.5e5;
    var tax = slabTax(ti, [[ex,0],[5e5,.05],[1e6,.20],[Infinity,.30]]);
    if (ti <= 5e5) tax = Math.max(0, tax - 12500);
    var sc = surcharge(ti, tax, false);
    return { tax: tax, sc: sc, cess: (tax + sc) * .04 };
  }
  var it = $("#it-form");
  if (it) {
    var runIt = function () {
      var inc = parseFloat($("#it-income").value) || 0;
      var sal = $("#it-salaried").checked;
      var ded = parseFloat($("#it-ded").value) || 0;
      var age = $("#it-age").value;
      var tiN = Math.max(0, inc - (sal ? 75000 : 0));
      var tiO = Math.max(0, inc - (sal ? 50000 : 0) - ded);
      var n = newRegime(tiN), o = oldRegime(tiO, age);
      var tn = n.tax + n.sc + n.cess, to = o.tax + o.sc + o.cess;
      var row = function (l, a, b) { return "<tr><th scope='row'>" + l + "</th><td>" + a + "</td><td>" + b + "</td></tr>"; };
      var best = Math.abs(tn - to) < 1 ? "Both regimes give the same tax."
        : (tn < to ? "New regime saves you " + inr(to - tn) + " a year." : "Old regime saves you " + inr(tn - to) + " a year.");
      $("#it-out").innerHTML =
        "<table class='rates' style='margin:0'><thead><tr><th></th><th>New regime</th><th>Old regime</th></tr></thead><tbody>" +
        row("Taxable income", inr(tiN), inr(tiO)) +
        row("Income tax", inr(n.tax), inr(o.tax)) +
        row("Surcharge", inr(n.sc), inr(o.sc)) +
        row("Health & education cess (4%)", inr(n.cess), inr(o.cess)) +
        row("<b>Total tax</b>", "<b>" + inr(tn) + "</b>", "<b>" + inr(to) + "</b>") +
        "</tbody></table><p class='verdict'>" + best + "</p>";
    };
    it.addEventListener("input", runIt); runIt();
  }

  /* ---------- EMI ---------- */
  var emi = $("#emi-form");
  if (emi) {
    var runEmi = function () {
      var p = parseFloat($("#emi-p").value) || 0, r = (parseFloat($("#emi-r").value) || 0) / 1200,
          n = Math.round((parseFloat($("#emi-y").value) || 0) * 12);
      var e = n ? (r ? p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : p / n) : 0;
      $("#emi-out").innerHTML = "<dl><dt>Monthly EMI</dt><dd>" + inr(e) + "</dd><dt>Total interest</dt><dd>" +
        inr(e * n - p) + "</dd><dt class='total'>Total repayment</dt><dd class='total'>" + inr(e * n) + "</dd></dl>";
    };
    emi.addEventListener("input", runEmi); runEmi();
  }

  /* ---------- PF & ESI ---------- */
  var pf = $("#pf-form");
  if (pf) {
    var runPf = function () {
      var basic = parseFloat($("#pf-basic").value) || 0, gross = parseFloat($("#pf-gross").value) || 0;
      var capped = $("#pf-cap").checked;
      var pfWage = capped ? Math.min(basic, 25000) : basic;
      var eeP = pfWage * .12, eps = Math.min(basic, 25000) * .0833, epf = pfWage * .12 - eps;
      var esiOn = gross > 0 && gross <= 21000;
      var eeE = esiOn ? gross * .0075 : 0, erE = esiOn ? gross * .0325 : 0;
      $("#pf-out").innerHTML = "<dl>" +
        "<dt>Employee PF (12%)</dt><dd>" + inr(eeP) + "</dd>" +
        "<dt>Employer EPF (3.67%)</dt><dd>" + inr(epf) + "</dd>" +
        "<dt>Employer EPS (8.33%)</dt><dd>" + inr(eps) + "</dd>" +
        "<dt>Employee ESI (0.75%)</dt><dd>" + inr(eeE) + "</dd>" +
        "<dt>Employer ESI (3.25%)</dt><dd>" + inr(erE) + "</dd>" +
        "<dt class='total'>Total employer cost</dt><dd class='total'>" + inr(epf + eps + erE) + "</dd></dl>" +
        (esiOn ? "" : "<p class='small muted' style='margin:10px 0 0'>ESI applies only when gross wages are ₹21,000 a month or less.</p>");
    };
    pf.addEventListener("input", runPf); runPf();
  }

  /* ---------- Analytics hook (works once GA4 is added; harmless before) ---------- */
  var track = function (name, params) {
    try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) {}
  };
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest ? ev.target.closest("a") : null;
    if (!a || !a.href) return;
    if (a.href.indexOf("wa.me/") > -1) track("whatsapp_click", { link_url: location.pathname });
    else if (a.href.indexOf("tel:") === 0) track("phone_click", { link_url: location.pathname });
  });

  /* ---------- Enquiry form → email (FormSubmit) → thank-you page, WhatsApp as fallback ---------- */
  var FORM_ENDPOINT = "https://formsubmit.co/ajax/finmantraadvisor@gmail.com";
  $$("form[data-enquiry]").forEach(function (f) {
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if ($(".hp input", f) && $(".hp input", f).value) return;
      var status = $(".form-status", f), btn = $("button[type=submit]", f);
      var v = function (n) { var el = f.elements[n]; return el ? el.value.trim() : ""; };
      if (!v("name") || !v("phone")) { status.textContent = "Please add your name and phone number."; return; }
      var msg = "Hello MyFinMantra, I'd like a consultation.\n\nName: " + v("name") + "\nPhone: " + v("phone") +
        (v("email") ? "\nEmail: " + v("email") : "") + (v("service") ? "\nService: " + v("service") : "") +
        (v("city") ? "\nCity: " + v("city") : "") + (v("message") ? "\n\n" + v("message") : "");
      var waUrl = "https://wa.me/" + WA + "?text=" + encodeURIComponent(msg);
      try { sessionStorage.setItem("mfm_wa", waUrl); } catch (e) {}
      var data = {
        name: v("name"), phone: v("phone"), email: v("email"), city: v("city"),
        service: v("service"), message: v("message"),
        page: location.pathname, source: (location.search || "direct"),
        _subject: "New enquiry: " + v("service") + " — " + v("name"),
        _template: "table", _captcha: "false"
      };
      if (v("email")) data._replyto = v("email");
      status.textContent = "Sending your enquiry…";
      if (btn) btn.disabled = true;
      var fallback = function () {
        status.innerHTML = "We couldn't send the form just now. <a href='" + waUrl + "' target='_blank' rel='noopener'>Send it on WhatsApp instead</a> or call +91 97118 99555.";
        if (btn) btn.disabled = false;
      };
      if (!window.fetch) { window.open(waUrl, "_blank", "noopener"); return; }
      fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(data)
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && String(res.j.success) !== "false") {
            track("generate_lead", { service: v("service") });
            location.href = "thank-you.html";
          } else { fallback(); }
        })
        .catch(fallback);
    });
  });

  /* Thank-you page: offer WhatsApp with the same details */
  var waBtn = $("[data-wa-followup]");
  if (waBtn) { try { var u = sessionStorage.getItem("mfm_wa"); if (u) waBtn.href = u; } catch (e) {} }
})();
