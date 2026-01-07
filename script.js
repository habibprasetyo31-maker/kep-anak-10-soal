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
let currentQuestionIndex = 0;

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

const navNumbers = document.getElementById("question-numbers");

/**********************
 * UTIL
 **********************/
function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

/**********************
 * LOAD QUESTIONS
 **********************/
async function loadQuestions() {
  const res = await fetch("questions.json", { cache: "no-store" });
  questions = await res.json();

  // random soal + random opsi
  questions = shuffle(questions).map((q) => ({
    ...q,
    options: shuffle([...q.options]),
  }));
}

/**********************
 * RENDER QUESTIONS
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

  attachAnswerEvents();
  showQuestion();
}

/**********************
 * ANSWER HANDLER
 **********************/
function attachAnswerEvents() {
  document.querySelectorAll("input[type=radio]").forEach((input) => {
    input.addEventListener("change", (e) => {
      const index = parseInt(e.target.name.replace("q", ""));
      answers[index] = e.target.value;

      // highlight option
      document
        .querySelectorAll(`input[name="q${index}"]`)
        .forEach((el) => el.closest(".option").classList.remove("selected"));
      e.target.closest(".option").classList.add("selected");

      // 🔥 update indikator
      updateNavStatus(index);
    });
  });
}

/**********************
 * NAVIGATION NUMBERS
 **********************/
function renderQuestionNumbers() {
  navNumbers.innerHTML = "";

  questions.forEach((_, i) => {
    const div = document.createElement("div");
    div.className = "circle";
    div.textContent = i + 1;

    div.addEventListener("click", () => {
      currentQuestionIndex = i;
      showQuestion();
    });

    navNumbers.appendChild(div);
  });
}

function updateNavStatus(index) {
  const circles = document.querySelectorAll(".nav-circle .circle");
  if (circles[index]) {
    circles[index].classList.add("answered");
  }
}

function updateActiveNav() {
  document.querySelectorAll(".nav-circle .circle").forEach((el, i) => {
    el.classList.toggle("current", i === currentQuestionIndex);
  });
}

/**********************
 * SHOW SINGLE QUESTION
 **********************/
function showQuestion() {
  document.querySelectorAll(".question").forEach((q, i) => {
    q.style.display = i === currentQuestionIndex ? "block" : "none";
  });

  updateActiveNav();
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

  resultText.innerHTML = `
    Skor: <b>${score}/${questions.length}</b><br>
    ${isAuto ? `<br><b>UJIAN DIHENTIKAN</b><br>${reason}` : ""}
  `;

  renderReview();
  sendResult(score, reason);
}

/**********************
 * REVIEW
 **********************/
function renderReview() {
  reviewContainer.innerHTML = "";

  questions.forEach((q, i) => {
    const correct = answers[i] === q.correct;

    const div = document.createElement("div");
    div.className = "question";
    div.innerHTML = `
      <p><b>${i + 1}. ${q.text}</b></p>
      <p>Jawaban Anda: <b>${answers[i] || "-"}</b></p>
      <p>Jawaban Benar: <b>${q.correct}</b></p>
      <p style="color:${correct ? "#4caf50" : "#f44336"}">
        ${correct ? "✔ Benar" : "✘ Salah"}
      </p>
    `;
    reviewContainer.appendChild(div);
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
      time: new Date().toISOString(),
    }),
  });
}

/**********************
 * ANTI CHEAT
 **********************/
function autoSubmit(reason) {
  alert("Ujian dihentikan: " + reason);
  submitExam(true, reason);
}

function setupAntiCheat() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) autoSubmit("Berpindah tab");
  });

  document.addEventListener("contextmenu", (e) => e.preventDefault());
}

/**********************
 * BUTTON EVENTS
 **********************/
document.getElementById("start-btn").addEventListener("click", async () => {
  if (!studentName.value || !studentNim.value || !studentClass.value) {
    alert("Lengkapi data peserta");
    return;
  }

  await loadQuestions();
  renderQuestions();
  renderQuestionNumbers();

  loginPage.style.display = "none";
  examPage.style.display = "block";

  setupAntiCheat();
  startTimer();

  document.getElementById("info-student").innerHTML = `
    ${studentName.value}<br>${studentNim.value}<br>${studentClass.value}
  `;
});

document.getElementById("next-btn").addEventListener("click", () => {
  if (currentQuestionIndex < questions.length - 1) {
    currentQuestionIndex++;
    showQuestion();
  }
});

document.getElementById("prev-btn").addEventListener("click", () => {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    showQuestion();
  }
});

document.getElementById("submit-btn").addEventListener("click", () => {
  if (confirm("Kirim jawaban sekarang?")) submitExam(false);
});
