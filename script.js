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

const infoName = document.getElementById("info-name");
const infoNim = document.getElementById("info-nim");
const infoClass = document.getElementById("info-class");

const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const submitBtn = document.getElementById("submit-btn");

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
 * RENDER QUESTION
 **********************/
function renderQuestion() {
  const q = questions[currentIndex];
  questionsEl.innerHTML = "";

  const div = document.createElement("div");
  div.className = "question";

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
      div.querySelectorAll(".option").forEach(o => o.classList.remove("selected"));
      input.closest(".option").classList.add("selected");
      updateNav();
    };
  });

  questionsEl.appendChild(div);
  updateNav();
  updateSubmitVisibility();
  updateNavButtons();
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

function updateNavButtons() {
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === questions.length - 1;
}

function updateSubmitVisibility() {
  submitBtn.style.display =
    currentIndex === questions.length - 1 ? "inline-block" : "none";
}

/**********************
 * BUTTON EVENTS
 **********************/
prevBtn.onclick = () => {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
};

nextBtn.onclick = () => {
  if (currentIndex < questions.length - 1) {
    currentIndex++;
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

  document.body.style.background = "#f8fafc";
  document.body.style.color = "#111827";

  let correct = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.correct) correct++;
  });

  let html = `
    <h2>Hasil Ujian</h2>
    <p><b>Nama:</b> ${studentName.value}</p>
    <p><b>NIM:</b> ${studentNim.value}</p>
    <p><b>Kelas:</b> ${studentClass.value}</p>
    <p><b>Skor:</b> ${correct} / ${questions.length}</p>
  `;

  if (auto) {
    html += `
      <div class="cheat-warning">
        <h3>Ujian Dihentikan Otomatis</h3>
        <p><b>Alasan:</b> ${reason}</p>
        <p class="note">Review jawaban tidak ditampilkan.</p>
      </div>
    `;
  } else {
    html += `<hr><h3>Review Jawaban</h3>`;
    questions.forEach((q, i) => {
      const benar = answers[i] === q.correct;
      html += `
        <div class="review-item ${benar ? "benar" : "salah"}">
          <b>${i + 1}. ${q.text}</b><br>
          Jawaban Anda: <b>${answers[i] || "-"}</b><br>
          Jawaban Benar: <b>${q.correct}</b><br>
          <span>${benar ? "✔ Benar" : "✘ Salah"}</span>
        </div>
      `;
    });
  }

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

// Disable klik kanan
document.addEventListener("contextmenu", e => {
  e.preventDefault();
  autoSubmit("Klik kanan terdeteksi");
});

// Disable inspect
document.addEventListener("keydown", e => {
  if (e.key === "F12") autoSubmit("Inspect Element (F12)");
  if (e.ctrlKey && e.shiftKey && ["I","J","C"].includes(e.key.toUpperCase()))
    autoSubmit("Developer Tools");
  if (e.ctrlKey && e.key.toUpperCase() === "U")
    autoSubmit("View Source");
});

// Deteksi DevTools
setInterval(() => {
  if (!examRunning) return;
  const w = window.outerWidth - window.innerWidth;
  const h = window.outerHeight - window.innerHeight;
  if (w > 160 || h > 160) autoSubmit("Developer Tools terdeteksi");
}, 1000);

/**********************
 * START EXAM
 **********************/
document.getElementById("start-btn").onclick = async () => {
  if (!studentName.value || !studentNim.value || !studentClass.value) {
    alert("Lengkapi data peserta");
    return;
  }

  infoName.textContent = studentName.value;
  infoNim.textContent = studentNim.value;
  infoClass.textContent = studentClass.value;

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

submitBtn.onclick = () => {
  if (confirm("Kirim jawaban sekarang?")) submitExam(false);
};
