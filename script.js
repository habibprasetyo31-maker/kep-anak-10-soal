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
const timerEl = document.getElementById("timer");
const resultText = document.getElementById("result-text");
const reviewContainer = document.getElementById("review-container");

const navContainer = document.getElementById("question-numbers");

/**********************
 * UTIL
 **********************/
function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

/**********************
 * LOAD QUESTIONS
 **********************/
async function loadQuestions() {
  const res = await fetch("questions.json", { cache: "no-store" });
  let data = await res.json();

  // random soal
  data = shuffle(data);

  // random opsi jawaban
  questions = data.map(q => ({
    ...q,
    options: shuffle([...q.options])
  }));
}

/**********************
 * RENDER QUESTION
 **********************/
function renderQuestion(index) {
  questionsEl.innerHTML = "";

  const q = questions[index];
  const div = document.createElement("div");
  div.className = "question";

  div.innerHTML = `
    <p><b>${index + 1}. ${q.text}</b></p>
    <div class="options">
      ${q.options.map(opt => `
        <label class="option ${answers[index] === opt ? "selected" : ""}">
          <input type="radio" name="q${index}" value="${opt}" ${answers[index] === opt ? "checked" : ""}>
          ${opt}
        </label>
      `).join("")}
    </div>
  `;

  questionsEl.appendChild(div);

  document.querySelectorAll("input[type=radio]").forEach(radio => {
    radio.addEventListener("change", e => {
      answers[index] = e.target.value;
      updateNav();
      renderQuestion(index);
    });
  });

  updateNav();
}

/**********************
 * NAVIGATION NUMBER
 **********************/
function renderNav() {
  navContainer.innerHTML = "";
  questions.forEach((_, i) => {
    const btn = document.createElement("div");
    btn.className = "circle";
    btn.textContent = i + 1;

    btn.addEventListener("click", () => {
      currentIndex = i;
      renderQuestion(currentIndex);
    });

    navContainer.appendChild(btn);
  });
}

function updateNav() {
  document.querySelectorAll(".circle").forEach((el, i) => {
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

  if (isAuto) {
    resultText.innerHTML = `
      <b>UJIAN DIHENTIKAN OTOMATIS</b><br>
      Alasan: <b>${reason}</b><br><br>
      Skor: <b>${score}/${questions.length}</b>
    `;
    reviewContainer.innerHTML = ""; // 🔒 NO REVIEW
  } else {
    resultText.innerHTML = `
      Nama: <b>${studentName.value}</b><br>
      NIM: <b>${studentNim.value}</b><br>
      Skor: <b>${score}/${questions.length}</b>
    `;
    renderReview();
  }

  sendResult(score, reason);
}

/**********************
 * REVIEW (MANUAL ONLY)
 **********************/
function renderReview() {
  reviewContainer.innerHTML = "<h3>Review Jawaban</h3>";

  questions.forEach((q, i) => {
    const benar = answers[i] === q.correct;
    reviewContainer.innerHTML += `
      <div class="question">
        <p><b>${i + 1}. ${q.text}</b></p>
        <p>Jawaban Anda: <b>${answers[i] || "-"}</b></p>
        <p>Jawaban Benar: <b>${q.correct}</b></p>
        <p style="color:${benar ? "#4caf50" : "#f44336"}">
          ${benar ? "✔ Benar" : "✘ Salah"}
        </p>
      </div>
    `;
  });
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
      time: new Date().toISOString()
    })
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

  document.addEventListener("contextmenu", e => e.preventDefault());

  document.addEventListener("keydown", e => {
    if (e.key === "F12" || (e.ctrlKey && e.shiftKey)) {
      e.preventDefault();
      autoSubmit("Developer tools");
    }
  });
}

/**********************
 * REFRESH / CLOSE TAB
 **********************/
window.addEventListener("beforeunload", () => {
  if (!submitted) {
    autoSubmit("Refresh halaman");
  }
});

/**********************
 * START EXAM
 **********************/
document.getElementById("start-btn").addEventListener("click", async () => {
  if (!studentName.value || !studentNim.value || !studentClass.value) {
    alert("Lengkapi data peserta");
    return;
  }

  await loadQuestions();
  renderNav();
  renderQuestion(0);

  loginPage.style.display = "none";
  examPage.style.display = "block";

  setupAntiCheat();
  startTimer();

  document.documentElement.requestFullscreen?.();
});

/**********************
 * BUTTONS
 **********************/
document.getElementById("prev-btn").onclick = () => {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion(currentIndex);
  }
};

document.getElementById("next-btn").onclick = () => {
  if (currentIndex < questions.length - 1) {
    currentIndex++;
    renderQuestion(currentIndex);
  }
};

document.getElementById("submit-btn").onclick = () => {
  if (confirm("Kirim jawaban sekarang?")) submitExam(false);
};
