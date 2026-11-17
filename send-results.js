/* ============================================================
 * ОТПРАВКА РЕЗУЛЬТАТОВ УЧИТЕЛЮ · общий модуль для страниц уроков
 * ============================================================
 * Подключается к страницам классных/домашних работ двумя тегами
 * script ПЕРЕД закрывающим тегом body (в таком порядке):
 *   1) src="../config.js"
 *   2) src="../send-results.js"
 *
 * Что делает:
 *   1. Добавляет на слайд «Результат» блок «Отправить учителю»:
 *      поле имени + кнопка «Отправить 📩».
 *   2. Имя сохраняется в localStorage (общий для всех страниц сайт),
 *      поэтому на следующих уроках вводить его не нужно.
 *   3. При нажатии «Показать результат 📊» (и по кнопке «Отправить»)
 *      формируется отчёт и уходит в Telegram (см. config.js).
 *   4. Если ключи не настроены — понятная ошибка в консоли,
 *      а ученик может скопировать отчёт вручную.
 * ============================================================ */

(function () {
  "use strict";

  // ---------- Нормализация ответов (та же логика, что в тетради) ----------
  function canon(v) {
    v = (v || "").toLowerCase().replace(/\s+/g, "").replace(/[×∙⋅*xх]/g, "·");
    if (v === "равны" || v === "равно" || v === "равен" || v === "=") return "=";
    if (v === "больше" || v === ">") return ">";
    if (v === "меньше" || v === "<") return "<";
    return v;
  }
  function parseList(s) {
    return (String(s).match(/\d+/g) || []).map(Number).sort((a, b) => a - b);
  }
  function hasValue(inp) {
    if (inp.dataset.type === "list") return parseList(inp.value).length > 0;
    return !!canon(inp.value);
  }
  function isInputOk(inp) {
    if (inp.dataset.type === "list") {
      const v = JSON.stringify(parseList(inp.value));
      return (inp.dataset.a || "").split("|").some(function (a) {
        return JSON.stringify(parseList(a)) === v;
      });
    }
    const val = canon(inp.value);
    const acc = (inp.dataset.a || "").split("|");
    if (acc.some(function (a) { return canon(a) === val; })) return true;
    const lead = (val.match(/^\d+/) || [])[0];
    return !!(lead && acc.some(function (a) { return canon(a) === lead; }));
  }

  // ---------- Сбор результатов со страницы ----------
  function collect() {
    const inputs = Array.prototype.slice.call(
      document.querySelectorAll("input[data-a]")
    );
    const groups = {};   // группы оценивания: data-g + вес data-w
    const lines = [];    // строки отчёта
    let okCount = 0, badCount = 0, emptyCount = 0;

    inputs.forEach(function (inp) {
      const label = inp.dataset.label || inp.dataset.g || "?";
      const filled = hasValue(inp);
      const ok = filled && isInputOk(inp);
      const g = inp.dataset.g || label;
      if (!groups[g]) groups[g] = { w: parseFloat(inp.dataset.w) || 0, ok: true, has: false };
      groups[g].has = true;
      if (!ok) groups[g].ok = false;

      let mark = "·", verdict = "без ответа";
      if (ok) { mark = "✓"; verdict = ""; okCount++; }
      else if (filled) { mark = "✗"; verdict = " (правильно: " + (inp.dataset.a || "").split("|")[0] + ")"; badCount++; }
      else emptyCount++;
      lines.push(
        "  " + mark + " [" + label + "] " + (inp.value.trim() || "—") + verdict
      );
    });

    let score = 0, maxScore = 0;
    Object.keys(groups).forEach(function (g) {
      maxScore += groups[g].w;
      if (groups[g].ok && groups[g].has) score += groups[g].w;
    });
    return {
      lines: lines, score: Math.round(score * 10) / 10,
      maxScore: Math.round(maxScore * 10) / 10,
      okCount: okCount, badCount: badCount, emptyCount: emptyCount,
      total: inputs.length,
    };
  }

  // ---------- Текст отчёта ----------
  function buildReport(name) {
    const r = collect();
    const L = [];
    L.push("══════════════════════════════════════");
    L.push(document.title);
    L.push("══════════════════════════════════════");
    L.push("Ученик: " + name);
    L.push("Дата: " + new Date().toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }));
    L.push("");
    L.push("ИТОГ: " + r.okCount + " из " + r.total + " верно" +
      " (ошибок: " + r.badCount + ", без ответа: " + r.emptyCount + ")");
    L.push("БАЛЛЫ: " + r.score + " из " + r.maxScore);
    L.push("");
    L.push("ОТВЕТЫ:");
    Array.prototype.push.apply(L, r.lines);
    return L.join("\n");
  }

  // ---------- Отправка в Telegram ----------
  function splitText(text, max) {
    const chunks = [];
    let buf = "";
    text.split("\n").forEach(function (line) {
      if ((buf + line).length > max) { chunks.push(buf); buf = ""; }
      buf += line + "\n";
    });
    if (buf.trim()) chunks.push(buf);
    return chunks;
  }

  function sendTelegram(text) {
    const tg = (typeof CONFIG !== "undefined" && CONFIG.telegram) || {};
    if (!tg.botToken || !tg.chatId) {
      console.error(
        "[Уроки] Отправка в Telegram не настроена.\n" +
        "Открой файл config.js (в корне сайта) и впиши botToken и chatId.\n" +
        "Как получить — см. комментарий в начале того же файла."
      );
      return Promise.reject(new Error("нет ключей (config.js)"));
    }
    const chunks = splitText(text, 4000);
    let chain = Promise.resolve();
    chunks.forEach(function (chunk) {
      chain = chain.then(function () {
        return fetch("https://api.telegram.org/bot" + tg.botToken + "/sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: tg.chatId, text: chunk }),
        }).then(function (r) {
          return r.json().then(function (d) {
            if (!r.ok || !d.ok) throw new Error(d.description || ("HTTP " + r.status));
          });
        });
      });
    });
    return chain;
  }

  // ---------- Виджет на слайде «Результат» ----------
  let autoSent = false;

  function currentName() {
    const inp = document.getElementById("srName");
    return (inp && inp.value.trim()) || localStorage.getItem("tt_name") || "";
  }

  function setStatus(msg, cls) {
    const st = document.getElementById("srStatus");
    if (st) { st.textContent = msg; st.className = "sr-status " + (cls || ""); }
  }

  function doSend() {
    const name = currentName();
    if (!name) {
      setStatus("✏️ Введи имя ученика — иначе учитель не поймёт, чей это результат.", "err");
      const inp = document.getElementById("srName");
      if (inp) inp.focus();
      return;
    }
    localStorage.setItem("tt_name", name);
    setStatus("Отправляю…", "notice");
    sendTelegram(buildReport(name)).then(function () {
      setStatus("✅ Результат отправлен учителю!", "ok");
    }).catch(function (err) {
      setStatus("❌ Не отправлено: " + err.message + " (см. консоль F12)", "err");
    });
  }

  function init() {
    const results = document.querySelector(".results");
    if (!results || document.getElementById("srSend")) return;

    // Небольшой блок в стиле тетради
    const wrap = document.createElement("div");
    wrap.className = "sr-wrap";
    wrap.innerHTML =
      '<div class="sr-title">📩 Отправить результаты учителю</div>' +
      '<div class="sr-row">' +
      '<input id="srName" class="sr-name" type="text" maxlength="40" placeholder="Имя ученика" autocomplete="name">' +
      '<button id="srSend" class="sr-btn">Отправить 📩</button>' +
      '</div><div id="srStatus" class="sr-status"></div>';

    const style = document.createElement("style");
    style.textContent =
      ".sr-wrap{margin-top:18px;padding:16px 18px;background:rgba(255,255,255,.6);" +
      "border:2px dashed #b9a97f;border-radius:14px;text-align:center;font-family:inherit;}" +
      ".sr-title{font-size:16px;font-weight:bold;color:#2E5D4B;margin-bottom:10px;}" +
      ".sr-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;align-items:center;}" +
      ".sr-name{width:220px;max-width:100%;text-align:center;font-size:17px;font-weight:bold;" +
      "color:#E2574C;border:none;border-bottom:3px solid #E2574C;background:transparent;" +
      "font-family:inherit;outline:none;padding:4px 6px;border-radius:4px 4px 0 0;}" +
      ".sr-name:focus{background:#fff8d6;border-bottom-color:#c9a227;}" +
      ".sr-btn{border:none;cursor:pointer;background:#1f4634;color:#fff;font-family:inherit;" +
      "font-size:16px;font-weight:bold;padding:11px 22px;border-radius:12px;" +
      "box-shadow:3px 4px 0 rgba(31,70,52,.4);transition:transform .12s;}" +
      ".sr-btn:hover{transform:translateY(-2px);}" +
      ".sr-status{margin-top:10px;min-height:22px;font-size:14.5px;}" +
      ".sr-status.ok{color:#1f7a4d;font-weight:bold;}" +
      ".sr-status.err{color:#c2402f;font-weight:bold;}" +
      ".sr-status.notice{color:#8a7a5c;}";

    results.appendChild(style);
    results.appendChild(wrap);

    // Имя из памяти браузера (общее для всех страниц сайта)
    const saved = localStorage.getItem("tt_name");
    if (saved) document.getElementById("srName").value = saved;

    document.getElementById("srSend").addEventListener("click", doSend);

    // Автоотправка при первом показе результатов (если имя уже известно)
    if (typeof window.showResults === "function") {
      const orig = window.showResults;
      window.showResults = function () {
        const ret = orig.apply(this, arguments);
        if (!autoSent && currentName()) {
          autoSent = true;
          doSend();
        } else if (!currentName()) {
          setStatus("Введи имя и нажми «Отправить 📩», чтобы учитель получил результат.", "notice");
        }
        return ret;
      };
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
