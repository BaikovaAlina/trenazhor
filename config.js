/* ============================================================
 * CONFIG — НАСТРОЙКА ОТПРАВКИ РЕЗУЛЬТАТОВ
 * ============================================================
 * Это ЕДИНСТВЕННОЕ место, куда вписываются токены и ключи.
 * Файл используется и тренажёром (script.js), и страницами
 * уроков (send-results.js).
 *
 * ── TELEGRAM (бесплатно, без сервера) ────────────────────────
 *  1. Напиши боту @BotFather в Telegram → команда /newbot
 *  2. Получи токен вида "123456789:AA..." → впиши в botToken
 *  3. Напиши своему боту любое сообщение (например /start)
 *  4. Узнай chat_id: открой в браузере
 *     https://api.telegram.org/bot<ТОКЕН>/getUpdates
 *     → найди "chat":{"id": 123456789} — это и есть chat_id
 *
 * ── EMAILJS (письма, 200/мес бесплатно) ──────────────────────
 *  emailjs.com → Service ID, Template ID (в шаблоне {{message}}),
 *  Account → API Keys → Public Key
 *
 * ── FORMSPREE (письма, 50/мес бесплатно) ─────────────────────
 *  formspree.io → endpoint вида "https://formspree.io/f/XXXX"
 *
 * Если ничего не заполнено — результаты можно скачать файлом,
 * а в консоли браузера будет понятная подсказка.
 * ============================================================ */
const CONFIG = {
  telegram: {
    botToken: "9298257364:AAGyPyjQ0c4Jmps3oyffHMYXpvTXdZ22zg4",
    chatId:   "7928474241",
  },
  emailjs: {
    serviceId:  "", // например "service_xxxxxxx"
    templateId: "", // например "template_xxxxxxx"
    publicKey:  "", // например "AbCdEf..."
  },
  formspree: {
    endpoint: "",   // например "https://formspree.io/f/XXXXXXX"
  },
  // Необязательно: подставляется в текст отчёта
  teacherName: "Учитель",
};
