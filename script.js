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
let timerInterval = null;
let timeLeft = 0;
let submitted = false;

/**********************
 * ELEMENTS
 **********************/
const loginPage = document.getElementById("login-page");
const examPage = document.getElementById("exam-page");
const resultPage = document.getElementById("result-page");

const studentName = document.getElementById("student-name");
const studentNim = document.getElementById("student-nim");
const studentClass = document.getElementById("student-class");

const questionsEl = document.getElementById("questions");
const resultText = document.getElementById("result-text");
const timerEl = document.getElementById("timer");

/**********************
 * SAFE QUESTION TEXT
 **********************/
function getQuestionText(q) {
  return q.text || q.question || q.soal || "Soal tidak tersedia";
}

/**********************
 * LOAD QUESTIONS
 **********************/
async function loadQuestions() {
  const res = await fetch("questions.json", { cache: "no-store" });
  questions = await res.json();
  questions = questions.sort(() => Math.random() - 0.5);
}

/**********************
 * RENDER QUESTIONS
 **********************/
function renderQuestions() {
  questionsEl.innerHTML = "";

  questions.forEach((q, i) => {
    const div = document.createElement("div");
    div.className = "question";

    div.innerHTML = `
      <p><b>${i + 1}. ${getQuestionText(q)}</b></p>
      <div class="options">
        ${q.options
          .map(
            (opt) => `
            <label class="option">
              <input type="radio" name="q${i}" value="${opt}">
              ${opt}
            </label>
          `
          )
          .join("")}
      </div>
    `;

    questionsEl.appendChild(div);
  });

  document.querySelectorAll("input[type=radio]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const qIndex = parseInt(e.target.name.replace("q", ""));
      answers[qIndex] = e.target.value;
    });
  });
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
 * SUBMIT
 **********************/
function submitExam(isAuto = false, reason = "") {
  if (submitted) return;
  submitted = true;
  clearInterval(timerInterval);

  let score = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.correct) score++;
  });

  examPage.style.display = "none";
  resultPage.style.display = "flex";

  resultText.innerHTML = isAuto
    ? `<b>UJIAN DIHENTIKAN OTOMATIS</b><br>Alasan: ${reason}<br><br>
       Skor: <b>${score}/${questions.length}</b>`
    : `Nama: <b>${studentName.value}</b><br>
       NIM: <b>${studentNim.value}</b><br>
       Skor: <b>${score}/${questions.length}</b>`;

  if (!isAuto) renderReview();
  sendResult(score, reason);
}

/**********************
 * REVIEW
 **********************/
function renderReview() {
  const container = document.createElement("div");
  container.style.marginTop = "20px";

  questions.forEach((q, i) => {
    const userAnswer = answers[i];
    const correct = userAnswer === q.correct;

    container.innerHTML += `
      <div class="question">
        <p><b>${i + 1}. ${getQuestionText(q)}</b></p>
        <p>Jawaban Anda: <b>${userAnswer ?? "-"}</b></p>
        <p>Jawaban Benar: <b>${q.correct}</b></p>
        <p style="font-weight:600;color:${correct ? "#4caf50" : "#f44336"}">
          ${correct ? "✔ Benar" : "✘ Salah"}
        </p>
      </div>
    `;
  });

  resultPage.querySelector(".card").appendChild(container);
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
      timestamp: new Date().toISOString(),
    }),
  });
}

/**********************
 * ANTI CHEAT
 **********************/
function autoSubmit(reason) {
  alert("Pelanggaran terdeteksi: " + reason);
  submitExam(true, reason);
}

function setupAntiCheat() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) autoSubmit("Berpindah tab");
  });

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) autoSubmit("Keluar fullscreen");
  });

  document.addEventListener("contextmenu", (e) => e.preventDefault());

  document.addEventListener("keydown", (e) => {
    if (e.key === "F12" || (e.ctrlKey && e.shiftKey)) {
      e.preventDefault();
      autoSubmit("Developer tools");
    }
  });
}

/**********************
 * START
 **********************/
document.getElementById("start-btn").addEventListener("click", async () => {
  if (!studentName.value || !studentNim.value || !studentClass.value) {
    alert("Lengkapi data");
    return;
  }

  await loadQuestions();
  renderQuestions();

  loginPage.style.display = "none";
  examPage.style.display = "block";

  setupAntiCheat();
  startTimer();

  document.documentElement.requestFullscreen?.();
});

document.getElementById("submit-btn").addEventListener("click", () => {
  if (confirm("Kirim jawaban sekarang?")) submitExam(false);
});
