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
let currentIndex = 0;
let timerInterval = null;
let timeLeft = 0;
let submitted = false;
let examRunning = false;

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
const questionNumbersEl = document.getElementById("question-numbers");
const resultText = document.getElementById("result-text");
const reviewContainer = document.getElementById("review-container");
const timerEl = document.getElementById("timer");

/**********************
 * LOAD QUESTIONS
 **********************/
async function loadQuestions() {
  const res = await fetch("questions.json", { cache: "no-store" });
  let data = await res.json();

  // random soal & opsi
  data = data.sort(() => Math.random() - 0.5);
  data.forEach(q => q.options.sort(() => Math.random() - 0.5));

  questions = data;
}

/**********************
 * RENDER ALL QUESTIONS (SCROLL)
 **********************/
function renderAllQuestions() {
  if (!examRunning) return;

  questionsEl.innerHTML = questions.map((q, index) => `
    <div class="question" id="q-${index}">
      <p><b>${index + 1}. ${q.text}</b></p>
      <div class="options">
        ${q.options.map(opt => `
          <label class="option ${answers[index] === opt ? "selected" : ""}">
            <input type="radio" name="q${index}" value="${opt}">
            ${opt}
          </label>
        `).join("")}
      </div>
    </div>
  `).join("");

  // pasang event
  questions.forEach((_, index) => {
    document.querySelectorAll(`input[name="q${index}"]`).forEach(input => {
      input.checked = answers[index] === input.value;
      input.onchange = e => {
        answers[index] = e.target.value;
        currentIndex = index;
        updateNav();
      };
    });
  });

  updateNav();
}

/**********************
 * NAVIGATION NUMBER
 **********************/
function renderNav() {
  questionNumbersEl.innerHTML = "";
  questions.forEach((_, i) => {
    const div = document.createElement("div");
    div.className = "circle";
    div.textContent = i + 1;
    div.onclick = () => {
      currentIndex = i;
      document.getElementById(`q-${i}`).scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      updateNav();
    };
    questionNumbersEl.appendChild(div);
  });
}

function updateNav() {
  document.querySelectorAll(".nav-circle .circle").forEach((el, i) => {
    el.classList.toggle("current", i === currentIndex);
    el.classList.toggle("answered", answers[i] !== undefined);
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
function submitExam(auto = false, reason = "") {
  if (submitted) return;

  submitted = true;
  examRunning = false;

  clearInterval(timerInterval);
  document.exitFullscreen?.();

  let score = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.correct) score++;
  });

  examPage.style.display = "none";
  resultPage.style.display = "flex";

  // aktifkan mode terang hanya untuk hasil
  document.body.classList.add("result-mode");

  if (auto) {
    resultText.innerHTML = `
      <b>Ujian dihentikan otomatis</b><br>
      Alasan: ${reason}<br><br>
      Skor: <b>${score}/${questions.length}</b>
    `;
    reviewContainer.innerHTML = "";
  } else {
    resultText.innerHTML = `
      Nama: <b>${studentName.value}</b><br>
      NIM: <b>${studentNim.value}</b><br>
      Kelas: <b>${studentClass.value}</b><br>
      Skor: <b>${score}/${questions.length}</b>
    `;
    renderReview();
  }

  sendResult(score, reason);
}

/**********************
 * REVIEW
 **********************/
function renderReview() {
  let html = "<h3>Review Jawaban</h3>";
  questions.forEach((q, i) => {
    const benar = answers[i] === q.correct;
    html += `
      <div class="question">
        <p><b>${i + 1}. ${q.text}</b></p>
        <p>Jawaban Anda: <b>${answers[i] || "-"}</b></p>
        <p>Jawaban Benar: <b>${q.correct}</b></p>
        <p style="color:${benar ? "#16a34a" : "#dc2626"}">
          ${benar ? "✔ Benar" : "✘ Salah"}
        </p>
      </div>
    `;
  });
  reviewContainer.innerHTML = html;
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
  if (!examRunning) return;
  alert("Pelanggaran terdeteksi: " + reason);
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
  if (!submitted && examRunning) autoSubmit("Refresh halaman");
});

/**********************
 * START
 **********************/
document.getElementById("start-btn").onclick = async () => {
  if (!studentName.value || !studentNim.value || !studentClass.value) {
    alert("Lengkapi data peserta");
    return;
  }

  // pastikan mode dark aktif
  document.body.classList.remove("result-mode");

  await loadQuestions();
  renderNav();
  renderAllQuestions();

  loginPage.style.display = "none";
  examPage.style.display = "block";

  examRunning = true;
  startTimer();
  document.documentElement.requestFullscreen?.();
};

/**********************
 * NAV BUTTON
 **********************/
document.getElementById("submit-btn").onclick = () => {
  if (confirm("Kirim jawaban sekarang?")) submitExam(false);
};
