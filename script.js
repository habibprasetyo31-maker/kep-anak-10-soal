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
let isCheatSubmit = false;

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

  // RANDOM SOAL
  data = data.sort(() => Math.random() - 0.5);

  // RANDOM OPSI
  data.forEach(q => {
    q.options = q.options.sort(() => Math.random() - 0.5);
  });

  questions = data;
}

/**********************
 * RENDER
 **********************/
function renderQuestion(index) {
  if (submitted) return;

  const q = questions[index];
  questionsEl.innerHTML = `
    <div class="question">
      <p><b>${index + 1}. ${q.text}</b></p>
      <div class="options">
        ${q.options.map(opt => `
          <label class="option ${answers[index] === opt ? "selected" : ""}">
            <input type="radio" name="q${index}" value="${opt}" ${answers[index] === opt ? "checked" : ""}>
            ${opt}
          </label>
        `).join("")}
      </div>
    </div>
  `;

  document.querySelectorAll("input[type=radio]").forEach(el => {
    el.addEventListener("change", e => {
      answers[index] = e.target.value;
      updateNavStatus();
      renderQuestion(index);
    });
  });

  updateNavStatus();
}

function renderNav() {
  questionNumbersEl.innerHTML = "";
  questions.forEach((_, i) => {
    const div = document.createElement("div");
    div.className = "nav-number";
    div.textContent = i + 1;
    div.onclick = () => {
      currentIndex = i;
      renderQuestion(currentIndex);
    };
    questionNumbersEl.appendChild(div);
  });
}

function updateNavStatus() {
  document.querySelectorAll(".nav-number").forEach((el, i) => {
    el.classList.toggle("active", i === currentIndex);
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
  isCheatSubmit = auto;

  clearInterval(timerInterval);

  let score = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.correct) score++;
  });

  examPage.style.display = "none";
  resultPage.style.display = "flex";

  // PAKSA DARK UI
  document.body.style.background = "#0b0f12";

  if (auto) {
    resultText.innerHTML = `
      <b>UJIAN DIHENTIKAN OTOMATIS</b><br>
      Alasan: ${reason}<br><br>
      Skor: <b>${score}/${questions.length}</b>
    `;
    reviewContainer.innerHTML = "";
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

function renderReview() {
  if (isCheatSubmit) return;

  let html = "<h3>Review Jawaban</h3>";
  questions.forEach((q, i) => {
    const correct = answers[i] === q.correct;
    html += `
      <div class="question">
        <p><b>${i + 1}. ${q.text}</b></p>
        <p>Jawaban Anda: <b>${answers[i] || "-"}</b></p>
        <p>Jawaban Benar: <b>${q.correct}</b></p>
        <p style="color:${correct ? "#4caf50" : "#f44336"}">
          ${correct ? "✔ Benar" : "✘ Salah"}
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
  alert("Pelanggaran terdeteksi: " + reason);
  submitExam(true, reason);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && !submitted) autoSubmit("Berpindah tab");
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && !submitted)
    autoSubmit("Keluar fullscreen");
});

window.addEventListener("beforeunload", () => {
  if (!submitted) autoSubmit("Refresh halaman");
});

/**********************
 * START
 **********************/
document.getElementById("start-btn").onclick = async () => {
  if (!studentName.value || !studentNim.value || !studentClass.value) {
    alert("Lengkapi data");
    return;
  }

  await loadQuestions();
  renderNav();
  renderQuestion(0);

  loginPage.style.display = "none";
  examPage.style.display = "block";

  startTimer();
  document.documentElement.requestFullscreen?.();
};

document.getElementById("next-btn").onclick = () => {
  if (currentIndex < questions.length - 1) {
    currentIndex++;
    renderQuestion(currentIndex);
  }
};

document.getElementById("prev-btn").onclick = () => {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion(currentIndex);
  }
};

document.getElementById("submit-btn").onclick = () => {
  if (confirm("Kirim jawaban sekarang?")) submitExam(false);
};
