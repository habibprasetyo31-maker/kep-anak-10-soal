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

  // random soal
  data = data.sort(() => Math.random() - 0.5);

  // random opsi
  data.forEach(q => {
    q.options = q.options.sort(() => Math.random() - 0.5);
  });

  questions = data;
}

/**********************
 * RENDER ALL QUESTIONS
 **********************/
function renderAllQuestions() {
  questionsEl.innerHTML = "";

  questions.forEach((q, index) => {
    const div = document.createElement("div");
    div.className = "question";
    div.id = `question-${index}`;

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
  });

  document.querySelectorAll("input[type=radio]").forEach(input => {
    input.addEventListener("change", e => {
      const qIndex = Number(e.target.name.replace("q", ""));
      answers[qIndex] = e.target.value;

      // reset selected
      document
        .querySelectorAll(`input[name="q${qIndex}"]`)
        .forEach(i => i.closest(".option").classList.remove("selected"));

      e.target.closest(".option").classList.add("selected");

      updateNav();
    });
  });
}

/**********************
 * NAVIGATION NUMBERS
 **********************/
function renderNav() {
  questionNumbersEl.innerHTML = "";

  questions.forEach((_, i) => {
    const div = document.createElement("div");
    div.className = "nav-number";
    div.textContent = i + 1;

    div.onclick = () => {
      document
        .getElementById(`question-${i}`)
        .scrollIntoView({ behavior: "smooth", block: "start" });
    };

    questionNumbersEl.appendChild(div);
  });

  updateNav();
}

function updateNav() {
  document.querySelectorAll(".nav-number").forEach((el, i) => {
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

  // mode terang untuk review
  document.body.style.background = "#f8fafc";
  document.body.style.color = "#111827";

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

/**********************
 * REVIEW
 **********************/
function renderReview() {
  let html = "<h3>Review Jawaban</h3>";

  questions.forEach((q, i) => {
    const benar = answers[i] === q.correct;
    html += `
      <div class="question" style="background:#fff;border:1px solid #e5e7eb">
        <p><b>${i + 1}. ${q.text}</b></p>
        <p>Jawaban Anda: <b>${answers[i] || "-"}</b></p>
        <p>Jawaban Benar: <b>${q.correct}</b></p>
        <p style="font-weight:600;color:${benar ? "#16a34a" : "#dc2626"}">
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
  if (examRunning && !submitted) autoSubmit("Refresh halaman");
});

/**********************
 * START EXAM
 **********************/
document.getElementById("start-btn").onclick = async () => {
  if (!studentName.value || !studentNim.value || !studentClass.value) {
    alert("Lengkapi data");
    return;
  }

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
 * SUBMIT BUTTON
 **********************/
document.getElementById("submit-btn").onclick = () => {
  if (confirm("Kirim jawaban sekarang?")) submitExam(false);
};
