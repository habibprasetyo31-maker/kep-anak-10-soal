/***********************
 * CONFIG
 ***********************/
const EXAM_DURATION_MIN = 30; // menit
const GOOGLE_SCRIPT_URL = window.GOOGLE_SCRIPT_URL;

/***********************
 * STATE
 ***********************/
let questions = [
  {
    q: "Contoh soal 1?",
    options: ["A", "B", "C", "D"],
    answer: 1
  },
  {
    q: "Contoh soal 2?",
    options: ["A", "B", "C", "D"],
    answer: 2
  }
];

let currentIndex = 0;
let answers = {};
let timerInterval;
let startTime;
let autoSubmitted = false;

/***********************
 * ELEMENTS
 ***********************/
const loginPage = document.getElementById("login-page");
const examPage = document.getElementById("exam-page");
const resultPage = document.getElementById("result-page");

const startBtn = document.getElementById("start-btn");
const submitBtn = document.getElementById("submit-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");

const questionBox = document.getElementById("questions");
const navBox = document.getElementById("question-numbers");
const timerEl = document.getElementById("timer");
const resultText = document.getElementById("result-text");
const infoStudent = document.getElementById("info-student");

/***********************
 * START EXAM
 ***********************/
startBtn.addEventListener("click", () => {
  const name = studentName.value.trim();
  const nim = studentNim.value.trim();
  const cls = studentClass.value.trim();

  if (!name || !nim || !cls) {
    alert("Lengkapi data terlebih dahulu");
    return;
  }

  infoStudent.innerText = `${name} | ${nim} | ${cls}`;

  loginPage.style.display = "none";
  examPage.style.display = "block";

  enableSecurity();
  startTimer();
  renderNav();
  renderQuestion();
});

/***********************
 * RENDER QUESTION
 ***********************/
function renderQuestion() {
  const q = questions[currentIndex];
  questionBox.innerHTML = `
    <div class="question">
      <p><b>${currentIndex + 1}. ${q.q}</b></p>
      <div class="options">
        ${q.options.map((opt, i) => `
          <label class="option ${answers[currentIndex] === i ? "selected" : ""}">
            <input type="radio" name="q${currentIndex}" ${answers[currentIndex] === i ? "checked" : ""}/>
            ${opt}
          </label>
        `).join("")}
      </div>
    </div>
  `;

  document.querySelectorAll(".option").forEach((el, i) => {
    el.onclick = () => {
      answers[currentIndex] = i;
      renderQuestion();
      renderNav();
    };
  });
}

/***********************
 * NAVIGATION
 ***********************/
function renderNav() {
  navBox.innerHTML = "";
  questions.forEach((_, i) => {
    const div = document.createElement("div");
    div.className = "circle";
    if (answers[i] !== undefined) div.classList.add("answered");
    if (i === currentIndex) div.classList.add("current");
    div.innerText = i + 1;
    div.onclick = () => {
      currentIndex = i;
      renderQuestion();
      renderNav();
    };
    navBox.appendChild(div);
  });
}

prevBtn.onclick = () => {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
    renderNav();
  }
};

nextBtn.onclick = () => {
  if (currentIndex < questions.length - 1) {
    currentIndex++;
    renderQuestion();
    renderNav();
  }
};

/***********************
 * TIMER
 ***********************/
function startTimer() {
  startTime = Date.now();
  const totalMs = EXAM_DURATION_MIN * 60 * 1000;

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const left = totalMs - elapsed;

    if (left <= 0) {
      clearInterval(timerInterval);
      submitExam(true);
    }

    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    timerEl.innerText = `Waktu: ${m}:${s.toString().padStart(2, "0")}`;
  }, 1000);
}

/***********************
 * SUBMIT
 ***********************/
submitBtn.onclick = () => submitExam(false);

function submitExam(isAuto) {
  clearInterval(timerInterval);
  autoSubmitted = isAuto;

  let score = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.answer) score++;
  });

  examPage.style.display = "none";
  resultPage.style.display = "flex";

  if (autoSubmitted) {
    resultText.innerHTML = `
      <b>Ujian dihentikan otomatis</b><br>
      Karena terdeteksi pelanggaran.<br>
      Skor Anda: ${score}/${questions.length}
    `;
  } else {
    renderReview(score);
  }

  sendResult(score);
}

/***********************
 * REVIEW
 ***********************/
function renderReview(score) {
  let html = `<b>Skor: ${score}/${questions.length}</b><hr>`;
  questions.forEach((q, i) => {
    const correct = q.answer === answers[i];
    html += `
      <p>
        <b>${i + 1}. ${q.q}</b><br>
        Jawaban Anda: ${q.options[answers[i]] || "-"}<br>
        Jawaban Benar: ${q.options[q.answer]}<br>
        <span style="color:${correct ? "#4caf50" : "#f44336"}">
          ${correct ? "✔ Benar" : "✘ Salah"}
        </span>
      </p>
      <hr>
    `;
  });
  resultText.innerHTML = html;
}

/***********************
 * SEND RESULT
 ***********************/
function sendResult(score) {
  fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      name: studentName.value,
      nim: studentNim.value,
      class: studentClass.value,
      score,
      autoSubmitted
    })
  }).catch(() => {});
}

/***********************
 * SECURITY
 ***********************/
function enableSecurity() {
  document.documentElement.requestFullscreen?.();

  document.addEventListener("copy", e => e.preventDefault());
  document.addEventListener("cut", e => e.preventDefault());
  document.addEventListener("paste", e => e.preventDefault());
  document.addEventListener("contextmenu", e => e.preventDefault());

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) submitExam(true);
  });

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) submitExam(true);
  });

  document.addEventListener("keydown", e => {
    if (
      e.key === "F12" ||
      (e.ctrlKey && ["c", "v", "x", "u", "s"].includes(e.key.toLowerCase()))
    ) {
      e.preventDefault();
      submitExam(true);
    }
  });
}
