/**********************
 * CONFIG
 **********************/
const GOOGLE_SCRIPT_URL = window.GOOGLE_SCRIPT_URL || "";
const TIME_PER_QUESTION = 60;

/**********************
 * STATE
 **********************/
let questions = [];
let answers = {};
let timeLeft = 0;
let timerInterval = null;
let examRunning = false;
let submitted = false;

/**********************
 * ELEMENTS
 **********************/
const loginPage = document.getElementById("login-page");
const examPage = document.getElementById("exam-page");
const resultPage = document.getElementById("result-page");

const questionsEl = document.getElementById("questions");
const numbersEl = document.getElementById("question-numbers");
const timerEl = document.getElementById("timer");
const resultText = document.getElementById("result-text");

/**********************
 * LOAD QUESTIONS
 **********************/
async function loadQuestions() {
  const res = await fetch("questions.json", { cache: "no-store" });
  let data = await res.json();

  data = data.sort(() => Math.random() - 0.5);
  data.forEach(q => q.options.sort(() => Math.random() - 0.5));

  questions = data;
}

/**********************
 * RENDER QUESTIONS (SCROLL)
 **********************/
function renderQuestions() {
  questionsEl.innerHTML = "";

  questions.forEach((q, i) => {
    const div = document.createElement("div");
    div.className = "question";
    div.dataset.index = i;

    div.innerHTML = `
      <p><b>${i + 1}. ${q.text}</b></p>
      <div class="options">
        ${q.options.map(opt => `
          <label class="option ${answers[i] === opt ? "selected" : ""}">
            <input type="radio" name="q${i}" value="${opt}">
            ${opt}
          </label>
        `).join("")}
      </div>
    `;

    div.querySelectorAll("input").forEach(input => {
      input.checked = answers[i] === input.value;
      input.onchange = e => {
        answers[i] = e.target.value;
        updateNav();
      };
    });

    questionsEl.appendChild(div);
  });
}

/**********************
 * NAVIGATION
 **********************/
function renderNav() {
  numbersEl.innerHTML = "";
  questions.forEach((_, i) => {
    const c = document.createElement("div");
    c.className = "circle";
    c.textContent = i + 1;
    c.onclick = () => scrollToQuestion(i);
    numbersEl.appendChild(c);
  });
}

function updateNav() {
  document.querySelectorAll(".circle").forEach((c, i) => {
    c.classList.toggle("answered", answers[i] !== undefined);
  });
}

function scrollToQuestion(i) {
  const q = document.querySelector(`.question[data-index="${i}"]`);
  q?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**********************
 * TIMER
 **********************/
function startTimer() {
  timeLeft = questions.length * TIME_PER_QUESTION;
  updateTimer();

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimer();
    if (timeLeft <= 0) autoSubmit("Waktu habis");
  }, 1000);
}

function updateTimer() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  timerEl.textContent = `Waktu: ${m}:${s < 10 ? "0" + s : s}`;
}

/**********************
 * SUBMIT & REVIEW
 **********************/
function submitExam(auto = false, reason = "") {
  if (submitted) return;
  submitted = true;
  examRunning = false;

  clearInterval(timerInterval);
  document.exitFullscreen?.();

  examPage.style.display = "none";
  resultPage.style.display = "flex";

  // MODE TERANG
  document.body.style.background = "#f8fafc";
  document.body.style.color = "#111827";

  let correct = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.correct) correct++;
  });

  let html = `
    <b>Skor:</b> ${correct} / ${questions.length}<br>
    ${auto ? `<b>Ujian dihentikan otomatis</b><br>Alasan: ${reason}` : ""}
    <hr><h3>Review Jawaban</h3>
  `;

  questions.forEach((q, i) => {
    const benar = answers[i] === q.correct;
    html += `
      <div style="text-align:left;margin-bottom:12px">
        <b>${i + 1}. ${q.text}</b><br>
        Jawaban Anda: <b>${answers[i] || "-"}</b><br>
        Jawaban Benar: <b>${q.correct}</b><br>
        <span style="color:${benar ? "#16a34a" : "#dc2626"}">
          ${benar ? "✔ Benar" : "✘ Salah"}
        </span>
      </div>
    `;
  });

  resultText.innerHTML = html;
  sendResult(correct, reason);
}

/**********************
 * SEND RESULT
 **********************/
function sendResult(score, reason) {
  if (!GOOGLE_SCRIPT_URL) return;
  fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({
      name: studentName.value,
      nim: studentNim.value,
      class: studentClass.value,
      score,
      reason,
      timestamp: new Date().toISOString()
    })
  });
}

/**********************
 * ANTI CHEAT
 **********************/
function autoSubmit(reason) {
  if (!examRunning) return;
  submitExam(true, reason);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) autoSubmit("Berpindah tab");
});

document.addEventListener("fullscreenchange", () => {
  if (examRunning && !document.fullscreenElement) {
    autoSubmit("Keluar fullscreen");
  }
});

window.addEventListener("beforeunload", () => {
  if (examRunning && !submitted) autoSubmit("Refresh halaman");
});

/**********************
 * START
 **********************/
document.getElementById("start-btn").onclick = async () => {
  if (!studentName.value || !studentNim.value || !studentClass.value) {
    alert("Lengkapi data peserta");
    return;
  }

  await loadQuestions();
  renderNav();
  renderQuestions();
  updateNav();

  loginPage.style.display = "none";
  examPage.style.display = "block";

  examRunning = true;
  startTimer();
  document.documentElement.requestFullscreen?.();
};

document.getElementById("submit-btn").onclick = () => {
  if (confirm("Kirim jawaban sekarang?")) submitExam(false);
};
