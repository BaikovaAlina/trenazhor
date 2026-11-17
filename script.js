/* ============================================================
 * ТРЕНАЖЁР ПО МАТЕМАТИКЕ · логика (vanilla JS)
 * ============================================================
 * Структура файла:
 *   1. CONFIG        — настройки отправки результатов (файл config.js)
 *   2. Состояние и вспомогательные функции
 *   3. Стартовый экран (имя + выбор варианта)
 *   4. Генерация слайдов из tasks.js
 *   5. Навигация (кнопки, стрелки, свайп)
 *   6. Проверка ответов
 *   7. Результаты и отчёт
 *   8. Отправка (Telegram / EmailJS / Formspree)
 *   9. Инициализация
 * ============================================================ */


/* ============================================================
 * 1. CONFIG
 * ============================================================
 * Настройки отправки (Telegram / EmailJS / Formspree) теперь
 * лежат в ОДНОМ месте — в файле config.js (подключается до
 * script.js на странице trainer.html). Сюда вписывать ничего
 * не нужно: открой config.js и впиши токены там.
 * ============================================================ */


/* ============================================================
 * 2. СОСТОЯНИЕ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 * (CONFIG — см. config.js)
 * ============================================================ */

const state = {
  name: "",        // имя ученика
  variant: null,   // ключ варианта: "K-5" | "D-5" | "K-6" | "D-6"
  cur: 0,          // индекс текущего слайда
};

// Краткие селекторы
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// Создание элемента с классом и текстом
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/* --- Нормализация ответа: "222 210" = "222210", "×" = "*" и т.п. --- */
function canon(v) {
  v = (v || "").toLowerCase().replace(/\s+/g, "").replace(/[×∙⋅*xх]/g, "·");
  if (v === "равны" || v === "равно" || v === "равен" || v === "=") return "=";
  if (v === "больше" || v === ">") return ">";
  if (v === "меньше" || v === "<") return "<";
  return v;
}

/* --- Список чисел (для полей типа "list"): порядок не важен --- */
function parseList(s) {
  return (String(s).match(/\d+/g) || []).map(Number).sort((a, b) => a - b);
}

/* --- Поле заполнено? --- */
function hasValue(inp) {
  if (inp.dataset.type === "list") return parseList(inp.value).length > 0;
  return !!canon(inp.value);
}

/* --- Совпадает ли введённое с эталоном (data-a) --- */
function matchesVal(inp, val) {
  const acc = (inp.dataset.a || "").split("|");
  if (acc.some((a) => canon(a) === val)) return true;
  // допускаем "222210 очков" → 222210 (если начинается с верного числа)
  const lead = (val.match(/^\d+/) || [])[0];
  if (lead && acc.some((a) => canon(a) === lead)) return true;
  return false;
}

/* --- Оценка одного поля: true / false --- */
function isInputOk(inp) {
  if (inp.dataset.type === "list") {
    const v = JSON.stringify(parseList(inp.value));
    return (inp.dataset.a || "").split("|").some((a) => JSON.stringify(parseList(a)) === v);
  }
  return matchesVal(inp, canon(inp.value));
}

/* --- Красивая дата: "16.11.2026, 21:10" --- */
function fmtDate(d) {
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* --- Заголовок варианта для отчёта --- */
function variantLabel(key) {
  const v = TASKS[key];
  return v ? `${v.title} (${key}) · ${v.topic}` : key;
}


/* ============================================================
 * 3. СТАРТОВЫЙ ЭКРАН: ИМЯ И ВЫБОР ВАРИАНТА
 * ============================================================ */

function initStartScreen() {
  const nameInput = $("#nameInput");
  const nameErr = $("#nameErr");

  // Подставляем сохранённое имя
  const savedName = localStorage.getItem("tt_name") || "";
  if (savedName) nameInput.value = savedName;

  // Подсветка выбранного варианта
  const savedVariant = localStorage.getItem("tt_variant");
  if (savedVariant && TASKS[savedVariant]) selectVariant(savedVariant);

  $$(".variant-card").forEach((card) => {
    card.addEventListener("click", () => selectVariant(card.dataset.variant));
  });

  // Валидация имени: 2–40 символов, буквы/цифры/пробел/дефис
  function validateName() {
    const v = nameInput.value.trim();
    if (!v) {
      nameErr.textContent = "✏️ Введи имя — без него учитель не поймёт, чей это результат.";
      return null;
    }
    if (v.length < 2 || v.length > 40 || !/^[A-Za-zА-Яа-яЁё0-9][A-Za-zА-Яа-яЁё0-9\s\-_.]*$/.test(v)) {
      nameErr.textContent = "✏️ Имя: 2–40 символов, буквы, цифры, пробелы и дефис.";
      return null;
    }
    nameErr.textContent = "";
    return v;
  }

  nameInput.addEventListener("input", () => { if (nameErr.textContent) validateName(); });
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); $("#startBtn").click(); }
  });

  // Кнопка «Начать»
  $("#startBtn").addEventListener("click", () => {
    const name = validateName();
    if (!name) { nameInput.focus(); return; }
    if (!state.variant) {
      nameErr.textContent = "✏️ Выбери вариант работы (К-5, Д-5, К-6 или Д-6).";
      return;
    }
    state.name = name;
    localStorage.setItem("tt_name", name);          // сохраним имя
    localStorage.setItem("tt_variant", state.variant);
    startWork();
  });
}

function selectVariant(key) {
  state.variant = key;
  $$(".variant-card").forEach((c) =>
    c.classList.toggle("selected", c.dataset.variant === key)
  );
}


/* ============================================================
 * 4. ГЕНЕРАЦИЯ СЛАЙДОВ ИЗ tasks.js
 * ============================================================ */

function renderSlides() {
  const v = TASKS[state.variant];
  const box = $("#slides");
  box.innerHTML = "";

  v.questions.forEach((q, qi) => {
    const slide = el("div", "slide");
    slide.appendChild(el("div", "margin-line"));
    if (q.crumb) slide.appendChild(el("div", "crumb", q.crumb));

    // Заголовок: номер + текст + пояснение
    const h2 = el("h2");
    h2.appendChild(el("span", "num", q.num || String(qi + 1)));
    h2.appendChild(document.createTextNode(q.title || ""));
    if (q.sub) h2.appendChild(el("span", "sub", q.sub));
    slide.appendChild(h2);

    const check = el("div", "check");
    (q.hints || []).forEach((h) => check.appendChild(el("div", "hint-line", h)));

    // Много подпунктов → две колонки (как в «разминке»)
    const gridCls = q.tasks.length >= 6 ? "grid2" : "grid1";
    const grid = el("div", gridCls);

    q.tasks.forEach((task, ti) => {
      const row = el("div", "task");
      // Если все поля — в конце строки (как в «рядах»), растягиваем текст,
      // чтобы поля встали справа (как в оригинальной тетради).
      // Если текст есть и после полей (напр. «Палиндром ли 12321? [да] А 12312? [нет]») —
      // оставляем обычное чередование.
      const firstInputAt = task.parts.findIndex((p) => typeof p !== "string");
      const textAfterInput = task.parts
        .slice(firstInputAt + 1)
        .some((p) => typeof p === "string" && p.trim().length > 1);
      if (!textAfterInput && firstInputAt >= 0) row.classList.add("tail");

      let firstText = true;
      task.parts.forEach((part) => {
        if (typeof part === "string") {
          // текстовая часть строки задания
          row.appendChild(el("span", firstText ? "lbl" : "ost", part));
          firstText = false;
        } else {
          // маркер поля ввода {"_input": N}
          const meta = task.inputs[part._input];
          const inp = document.createElement("input");
          inp.type = "text";
          inp.autocomplete = "off";
          inp.className = "blank " + (meta.type === "list" ? "lst" : "sm");
          inp.maxLength = meta.type === "list" ? 60 : 10;
          // данные для проверки и отчёта
          inp.dataset.a = meta.a;
          inp.dataset.g = meta.g;
          inp.dataset.w = String(meta.w);
          inp.dataset.type = meta.type || "";
          inp.dataset.q = String(qi);
          inp.dataset.t = String(ti);
          inp.dataset.i = String(part._input);
          row.appendChild(inp);
        }
      });
      grid.appendChild(row);
    });
    check.appendChild(grid);

    // Кнопка проверки этого задания
    const btn = el("button", "btn", "Проверить ✏️");
    btn.addEventListener("click", () => checkSlide(slide));
    check.appendChild(btn);
    check.appendChild(el("div", "verdict"));

    slide.appendChild(check);
    box.appendChild(slide);
  });

  $("#taskCrumb").textContent = variantLabel(state.variant);
  $("#taskDate").textContent = fmtDate(new Date());
}


/* ============================================================
 * 5. НАВИГАЦИЯ
 * ============================================================ */

function slides() { return $$("#slides .slide"); }

function show(i) {
  const list = slides();
  state.cur = Math.max(0, Math.min(list.length - 1, i));
  list.forEach((s, k) => s.classList.toggle("active", k === state.cur));
  $("#counter").textContent = (state.cur + 1) + " / " + list.length;
  $("#bar").style.width = Math.round((state.cur + 1) / list.length * 100) + "%";
  $("#prevBtn").disabled = state.cur === 0;
  $("#nextBtn").disabled = state.cur === list.length - 1;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initNavigation() {
  $("#prevBtn").addEventListener("click", () => show(state.cur - 1));
  $("#nextBtn").addEventListener("click", () => show(state.cur + 1));
  // «Проверить» в нижней панели — проверяет текущее задание
  $("#checkBtn").addEventListener("click", () => checkSlide(slides()[state.cur]));

  // Клавиатура: Enter — проверить, стрелки — листать
  document.addEventListener("keydown", (e) => {
    if ($("#screen-task").hidden) return;
    if (e.target && e.target.tagName === "INPUT") {
      if (e.key === "Enter") {
        e.preventDefault();
        checkSlide(slides()[state.cur]);
      }
      return;
    }
    if (e.key === "ArrowRight" || e.key === "PageDown") show(state.cur + 1);
    if (e.key === "ArrowLeft" || e.key === "PageUp") show(state.cur - 1);
  });

  // Свайп по экрану (для телефонов)
  let touchX = null;
  document.addEventListener("touchstart", (e) => {
    touchX = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) < 70) return;
    if (e.target.closest("input, button")) return;
    show(dx < 0 ? state.cur + 1 : state.cur - 1);
  }, { passive: true });
}


/* ============================================================
 * 6. ПРОВЕРКА ОТВЕТОВ (только верно/неверно, без подсказок)
 * ============================================================ */

function markInput(inp) {
  inp.classList.remove("ok", "bad");
  if (!hasValue(inp)) return null;      // пусто — не оцениваем
  const ok = isInputOk(inp);
  inp.classList.add(ok ? "ok" : "bad");
  return ok;
}

function checkSlide(slide) {
  const inputs = $$Inputs(slide);
  if (!inputs.length) return;

  let all = true, empty = 0;
  inputs.forEach((inp) => {
    const r = markInput(inp);
    if (r === null) { empty++; all = false; }
    else if (!r) all = false;
  });

  const vd = slide.querySelector(".verdict");
  if (!vd) return;
  if (empty > 0) {
    vd.className = "verdict no";
    vd.textContent = "✏️ Введи ответы во все поля.";
  } else if (all) {
    vd.className = "verdict ok";
    vd.textContent = "✅ Все верно! Следующее задание ждёт.";
  } else {
    vd.className = "verdict no";
    vd.textContent = "❌ Есть ошибки — перепроверь ещё раз.";
  }
}

// Все поля одного слайда
function $$Inputs(slide) {
  return Array.from(slide.querySelectorAll("input[data-a]"));
}

// Пока ученик печатает — снимаем отметку прошлой проверки
document.addEventListener("input", (e) => {
  if (e.target.matches && e.target.matches("input[data-a]")) {
    e.target.classList.remove("ok", "bad");
  }
});


/* ============================================================
 * 7. РЕЗУЛЬТАТЫ И ОТЧЁТ
 * ============================================================ */

/* Считает итоги по всем полям текущего варианта */
function computeResults() {
  const v = TASKS[state.variant];

  // Проверяем и подсвечиваем все поля (как в «тетради» на самопроверке)
  $$("#slides input[data-a]").forEach(markInput);

  // Группы оценивания (data-g): балл начисляется, если верны ВСЕ поля группы
  const groups = {};
  $$("#slides input[data-a]").forEach((inp) => {
    const g = inp.dataset.g;
    if (!groups[g]) groups[g] = { w: parseFloat(inp.dataset.w) || 0, ok: true, has: false };
    groups[g].has = true;
    if (!inp.classList.contains("ok")) groups[g].ok = false;
  });

  let score = 0, maxScore = 0;
  Object.values(groups).forEach((gr) => {
    maxScore += gr.w;
    if (gr.ok && gr.has) score += gr.w;
  });
  score = Math.round(score * 10) / 10;
  maxScore = Math.round(maxScore * 10) / 10;

  // Разбор по заданиям и строкам
  const questions = v.questions.map((q, qi) => {
    const tasks = q.tasks.map((task, ti) => {
      const fields = task.inputs.map((meta, ii) => {
        const inp = document.querySelector(
          `#slides input[data-q="${qi}"][data-t="${ti}"][data-i="${ii}"]`
        );
        const filled = inp && hasValue(inp);
        return {
          student: inp ? inp.value.trim() : "",
          correct: meta.a.split("|")[0],
          status: !filled ? "empty" : (inp.classList.contains("ok") ? "ok" : "bad"),
        };
      });
      const status = fields.every((f) => f.status === "ok") ? "ok"
        : fields.some((f) => f.status === "bad") ? "bad" : "empty";
      return { label: task.label, fields, status };
    });

    const status = tasks.every((t) => t.status === "ok") ? "ok"
      : tasks.some((t) => t.status === "bad") ? "bad" : "empty";

    // Бонусное задание (вес 0) не входит в баллы
    const isBonus = q.tasks.every((t) => t.inputs.every((i) => !i.w));
    return { num: q.num || String(qi + 1), title: q.title, tasks, status, isBonus };
  });

  // Итоги
  const scored = questions.filter((q) => !q.isBonus);
  const okCount = scored.filter((q) => q.status === "ok").length;
  const badCount = scored.filter((q) => q.status === "bad").length;
  const emptyCount = scored.filter((q) => q.status === "empty").length;
  const bonus = questions.find((q) => q.isBonus);

  return { questions, score, maxScore, okCount, badCount, emptyCount, bonus };
}

/* Текстовый отчёт для учителя (с правильными ответами) */
function buildReportText(res) {
  const L = [];
  L.push("══════════════════════════════════════");
  L.push("ТРЕНАЖЁР «МАТЕМАТИКА · УРОКИ 5–6»");
  L.push("══════════════════════════════════════");
  L.push("Ученик: " + state.name);
  L.push("Вариант: " + variantLabel(state.variant));
  L.push("Дата: " + fmtDate(new Date()));
  L.push("");
  L.push(`ИТОГ: ${res.okCount} из ${res.okCount + res.badCount + res.emptyCount} заданий верно` +
    ` (ошибок: ${res.badCount}, без ответа: ${res.emptyCount})`);
  L.push(`БАЛЛЫ: ${res.score} из ${res.maxScore}`);
  if (res.bonus) {
    L.push(`Бонус (№${res.bonus.num}): ` +
      (res.bonus.status === "ok" ? "верно" : res.bonus.status === "bad" ? "ошибка" : "без ответа"));
  }
  L.push("");

  res.questions.forEach((q) => {
    const mark = q.status === "ok" ? "[+]" : q.status === "bad" ? "[-]" : "[ ]";
    L.push(`${mark} ${q.num}. ${q.title}${q.isBonus ? " (бонус)" : ""}`);
    q.tasks.forEach((t) => {
      const tm = t.status === "ok" ? "  ✓" : t.status === "bad" ? "  ✗" : "  ·";
      const ans = t.fields.map((f) => f.student || "—").join("; ");
      let line = `${tm} ${t.label} → ${ans}`;
      if (t.status === "bad") {
        const right = t.fields.map((f) => f.correct).join("; ");
        line += `   (правильно: ${right})`;
      }
      L.push(line);
    });
    L.push("");
  });

  const badNums = res.questions
    .filter((q) => q.status === "bad" && !q.isBonus)
    .map((q) => "№" + q.num);
  L.push("ЗАДАНИЯ С ОШИБКАМИ: " + (badNums.length ? badNums.join(", ") : "нет 🎉"));
  return L.join("\n");
}

/* Отрисовка экрана результатов */
function renderResults(res) {
  $("#resCrumb").textContent = variantLabel(state.variant);
  $("#scoreVal").textContent = res.score;
  $("#scoreMax").textContent = ` / ${res.maxScore} баллов`;

  // Звёзды — по проценту баллов
  const pct = res.maxScore ? res.score / res.maxScore : 0;
  const n = pct >= 0.9 ? 5 : pct >= 0.75 ? 4 : pct >= 0.5 ? 3 : pct >= 0.25 ? 2 : pct > 0 ? 1 : 0;
  $("#stars").textContent = "★".repeat(n) + "☆".repeat(5 - n);

  const total = res.okCount + res.badCount + res.emptyCount;
  $("#rmsg").innerHTML =
    `<b>${escapeHtml(state.name)}</b>, решено верно <b>${res.okCount}</b> из <b>${total}</b> заданий.<br>` +
    `Ошибок: ${res.badCount} · без ответа: ${res.emptyCount}` +
    (res.bonus ? ` · бонус (№${res.bonus.num}): ${res.bonus.status === "ok" ? "верно ✅" : res.bonus.status === "bad" ? "ошибка ❌" : "—"}` : "");

  const badNums = res.questions
    .filter((q) => q.status === "bad" && !q.isBonus)
    .map((q) => "№" + q.num);
  $("#wrong").textContent = badNums.length
    ? "С ошибками: " + badNums.join(", ")
    : "Ошибок нет — блестяще! 🎉";

  // Список заданий с отметками
  const list = $("#resList");
  list.innerHTML = "";
  res.questions.forEach((q) => {
    const item = el("div", "res-item " + q.status);
    item.appendChild(el("span", "rmark", q.status === "ok" ? "✅" : q.status === "bad" ? "❌" : "▫️"));
    item.appendChild(el("span", "rnum", "№" + q.num));
    item.appendChild(el("span", "rtitle", q.title + (q.isBonus ? " (бонус)" : "")));
    const det = el("div", "ranswers");
    det.textContent = q.tasks.map((t) => {
      const ans = t.fields.map((f) => f.student || "—").join("; ");
      return `${t.status === "ok" ? "✓" : t.status === "bad" ? "✗" : "·"} ${t.label} → ${ans}`;
    }).join("  |  ");
    item.appendChild(det);
    list.appendChild(item);
  });

  $("#resName").textContent = state.name;
  $("#resDate").textContent = fmtDate(new Date());

  // Показываем экран
  $("#screen-start").hidden = true;
  $("#screen-task").hidden = true;
  $("#screen-results").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}


/* ============================================================
 * 8. ОТПРАВКА РЕЗУЛЬТАТОВ (Telegram / EmailJS / Formspree)
 * ============================================================ */

/* Telegram Bot API — https://core.telegram.org/bots/api */
async function sendTelegram(text) {
  const { botToken, chatId } = CONFIG.telegram;
  // Лимит сообщения — 4096 символов; длинный отчёт разбиваем на части
  const chunks = splitText(text, 4000);
  for (const chunk of chunks) {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) {
      throw new Error(data.description || ("HTTP " + r.status));
    }
  }
}

/* EmailJS — https://www.emailjs.com/docs/rest-api/send-email/ */
async function sendEmailJS(text) {
  const { serviceId, templateId, publicKey } = CONFIG.emailjs;
  const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: {
        to_name: CONFIG.teacherName,
        from_name: state.name,
        message: text,           // {{message}} в шаблоне письма
        variant: variantLabel(state.variant),
        score: `${state.lastResults.score} из ${state.lastResults.maxScore}`,
        datetime: fmtDate(new Date()),
      },
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(t || ("HTTP " + r.status));
  }
}

/* Formspree — https://formspree.io/forms */
async function sendFormspree(text) {
  const { endpoint } = CONFIG.formspree;
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      name: state.name,
      _subject: `Тренажёр: ${state.name} — ${variantLabel(state.variant)}`,
      message: text,
    }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    const msg = (data.errors || []).map((e) => e.message).join("; ");
    throw new Error(msg || ("HTTP " + r.status));
  }
}

/* Разбивка текста на части (для Telegram) */
function splitText(text, max) {
  const chunks = [];
  let buf = "";
  for (const line of text.split("\n")) {
    if ((buf + line).length > max) { chunks.push(buf); buf = ""; }
    buf += line + "\n";
  }
  if (buf.trim()) chunks.push(buf);
  return chunks;
}

/* Проверка: есть ли настроенный хотя бы один канал */
function configuredChannels() {
  const list = [];
  if (CONFIG.telegram.botToken && CONFIG.telegram.chatId) list.push(["Telegram", sendTelegram]);
  if (CONFIG.emailjs.serviceId && CONFIG.emailjs.templateId && CONFIG.emailjs.publicKey) list.push(["EmailJS", sendEmailJS]);
  if (CONFIG.formspree.endpoint) list.push(["Formspree", sendFormspree]);
  return list;
}

/* Главная функция отправки */
async function sendResults() {
  const status = $("#sendStatus");
  const text = buildReportText(state.lastResults);
  const channels = configuredChannels();

  // Нет ключей — понятная ошибка в консоли + подсказка на экране
  if (!channels.length) {
    console.error(
      "[Тренажёр] Отправка результатов не настроена.\n" +
      "Открой файл config.js (в корне сайта) и заполни ОДИН из каналов:\n" +
      "  • telegram  — botToken + chatId (как получить: см. комментарий над CONFIG)\n" +
      "  • emailjs   — serviceId + templateId + publicKey (бесплатно, emailjs.com)\n" +
      "  • formspree — endpoint вида https://formspree.io/f/XXXX (бесплатно, formspree.io)\n" +
      "Пока ключей нет, ученик может скачать отчёт кнопкой «Скачать отчёт (.txt)»."
    );
    status.className = "send-status notice";
    status.textContent =
      "⚠️ Отправка ещё не настроена. Учитель должен вписать ключи в файл config.js. " +
      "Скачай отчёт кнопкой выше и отправь учителю вручную.";
    return;
  }

  status.className = "send-status notice";
  status.textContent = "Отправляю…";
  const report = [];
  let okAny = false;

  for (const [name, fn] of channels) {
    try {
      await fn(text);
      okAny = true;
      report.push(`✅ ${name}: результат отправлен.`);
      console.log(`[Тренажёр] ${name}: отправлено.`);
    } catch (err) {
      report.push(`❌ ${name}: ${err.message}`);
      console.error(`[Тренажёр] Ошибка отправки через ${name}:`, err);
    }
  }

  status.className = "send-status " + (okAny ? "ok" : "err");
  status.textContent = report.join("  ·  ");
}


/* ============================================================
 * 9. ИНИЦИАЛИЗАЦИЯ И ПЕРЕХОДЫ МЕЖДУ ЭКРАНАМИ
 * ============================================================ */

function startWork() {
  renderSlides();
  show(0);
  $("#screen-start").hidden = true;
  $("#screen-results").hidden = true;
  $("#screen-task").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function finishWork() {
  const res = computeResults();
  state.lastResults = res;
  renderResults(res);

  // Автоматически отправим результат, если канал настроен
  if (configuredChannels().length) {
    sendResults();
  } else {
    console.error(
      "[Тренажёр] Результат посчитан, но отправка не настроена (config.js пуст).\n" +
      "Ученик может скачать отчёт кнопкой «Скачать отчёт (.txt)»."
    );
    $("#sendStatus").className = "send-status notice";
    $("#sendStatus").textContent =
      "⚠️ Автоотправка выключена: учитель ещё не настроил ключи (config.js). Можно скачать отчёт ниже.";
  }
}

function downloadReport() {
  const text = buildReportText(state.lastResults);
  const d = new Date();
  const stamp = d.toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const safeName = state.name.replace(/[^\wа-яё\- ]/gi, "").trim().replace(/\s+/g, "_") || "uchenik";
  const blob = new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" }); // BOM — чтобы Windows открыл кириллицу
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `otchet_${safeName}_${state.variant}_${stamp}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function initButtons() {
  $("#finishBtn").addEventListener("click", finishWork);
  $("#sendBtn").addEventListener("click", sendResults);
  $("#downloadBtn").addEventListener("click", downloadReport);

  // Пройти тот же вариант заново
  $("#retryBtn").addEventListener("click", () => {
    $("#screen-results").hidden = true;
    startWork();
    // очищаем поля
    $$("#slides input[data-a]").forEach((inp) => {
      inp.value = "";
      inp.classList.remove("ok", "bad");
    });
    $$("#slides .verdict").forEach((v) => { v.className = "verdict"; v.textContent = ""; });
    show(0);
  });

  // Вернуться к выбору варианта
  $("#homeBtn").addEventListener("click", () => {
    $("#screen-results").hidden = true;
    $("#screen-task").hidden = true;
    $("#screen-start").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// Старт при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  initStartScreen();
  initNavigation();
  initButtons();
});
