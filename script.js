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

const studentName = document.getElementById("student-name");
const studentNim = document.getElementById("student-nim");
const studentClass = document.getElementById("student-class");

/**********************
 * LOAD QUESTIONS
 **********************/
async function loadQuestions() {
  const res = await fetch("questions.json", { cache: "no-store" });
  let data = await res.json();

  // Random soal & opsi
  data = data.sort(() => Math.random() - 0.5);
  data.forEach(q => q.options.sort(() => Math.random() - 0.5));

  questions = data;
}

/**********************
 * RENDER SINGLE QUESTION
 **********************/
function renderQuestion() {
  const q = questions[currentIndex];
  questionsEl.innerHTML = "";

  const div = document.createElement("div");
  div.className = "question";
  div.dataset.index = currentIndex;

  div.innerHTML = `
    <p><b>${currentIndex + 1}. ${q.text}</b></p>
    <div class="options">
      ${q.options.map(opt => `
        <label class="option ${answers[currentIndex] === opt ? "selected" : ""}">
          <input type="radio" name="q${currentIndex}" value="${opt}">
          <span>${opt}</span>
        </label>
      `).join("")}
    </div>
  `;

  div.querySelectorAll("input").forEach(input => {
    input.checked = answers[currentIndex] === input.value;

    input.onchange = e => {
      answers[currentIndex] = e.target.value;

      // update selected UI
      div.querySelectorAll(".option")
        .forEach(o => o.classList.remove("selected"));
      input.closest(".option").classList.add("selected");

      updateNav();
    };
  });

  questionsEl.appendChild(div);

  updateNav();
  updateSubmitVisibility();
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

    c.onclick = () => {
      currentIndex = i;
      renderQuestion();
    };

    numbersEl.appendChild(c);
  });
}

function updateNav() {
  document.querySelectorAll(".circle").forEach((c, i) => {
    c.classList.toggle("answered", answers[i] !== undefined);
  });
}

function updateSubmitVisibility() {
  const submitBtn = document.getElementById("submit-btn");
  submitBtn.style.display =
    currentIndex === questions.length - 1 ? "inline-block" : "none";
}

/**********************
 * BUTTON NAV
 **********************/
document.getElementById("next-btn").onclick = () => {
  if (currentIndex < questions.length - 1) {
    currentIndex++;
    renderQuestion();
  }
};

document.getElementById("prev-btn").onclick = () => {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
};

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
 * SUBMIT & RESULT
 **********************/
function submitExam(auto = false, reason = "") {
  if (submitted) return;

  submitted = true;
  examRunning = false;
  clearInterval(timerInterval);
  document.exitFullscreen?.();

  examPage.style.display = "none";
  resultPage.style.display = "flex";

  // switch to light result
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

  currentIndex = 0;
  renderQuestion();

  loginPage.style.display = "none";
  examPage.style.display = "block";

  examRunning = true;
  startTimer();
  document.documentElement.requestFullscreen?.();
};

document.getElementById("submit-btn").onclick = () => {
  if (confirm("Kirim jawaban sekarang?")) submitExam(false);
};
