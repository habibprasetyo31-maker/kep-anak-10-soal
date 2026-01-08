/* ================= DATA ================= */
const questionsData = [
  {
    q: "Apa kepanjangan dari HTML?",
    options: [
      "Hyper Text Markup Language",
      "High Text Machine Language",
      "Hyperlinks and Text Markup Language",
      "Home Tool Markup Language"
    ]
  },
  {
    q: "CSS digunakan untuk?",
    options: [
      "Membuat logika program",
      "Mengatur tampilan website",
      "Menghubungkan database",
      "Menjalankan server"
    ]
  },
  {
    q: "JavaScript berjalan di?",
    options: [
      "Server saja",
      "Browser",
      "Database",
      "Compiler"
    ]
  }
];

/* ================= STATE ================= */
let currentIndex = 0;
let answers = {};
let timerInterval;
let timeLeft = 60 * 30; // 30 menit

/* ================= ELEMENT ================= */
const loginPage = document.getElementById("login-page");
const examPage = document.getElementById("exam-page");
const resultPage = document.getElementById("result-page");

const startBtn = document.getElementById("start-btn");
const questionsEl = document.getElementById("questions");
const numbersEl = document.getElementById("question-numbers");
const timerEl = document.getElementById("timer");
const infoStudent = document.getElementById("info-student");

/* ================= LOGIN ================= */
startBtn.onclick = () => {
  const name = studentName();
  const nim = studentNim();
  const cls = studentClass();

  if (!name || !nim || !cls) {
    alert("Lengkapi data terlebih dahulu");
    return;
  }

  infoStudent.innerHTML = `
    <strong>${name}</strong><br>
    NIM: ${nim}<br>
    Kelas: ${cls}
  `;

  loginPage.style.display = "none";
  examPage.style.display = "block";

  startTimer();
  renderQuestions();
  renderNumbers();
  setCurrent(0);
};

/* ================= RENDER QUESTIONS ================= */
function renderQuestions() {
  questionsEl.innerHTML = "";

  questionsData.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "question";
    div.dataset.index = index;

    div.innerHTML = `
      <p><strong>${index + 1}.</strong> ${item.q}</p>
      <div class="options">
        ${item.options
          .map(
            (opt, i) => `
          <label class="option ${answers[index] === i ? "selected" : ""}">
            <input type="radio" name="q${index}" ${answers[index] === i ? "checked" : ""}/>
            ${opt}
          </label>`
          )
          .join("")}
      </div>
    `;

    div.querySelectorAll(".option").forEach((opt, i) => {
      opt.onclick = () => {
        answers[index] = i;
        renderQuestions();
        updateNumbers();
      };
    });

    questionsEl.appendChild(div);
  });
}

/* ================= NAV NUMBERS ================= */
function renderNumbers() {
  numbersEl.innerHTML = "";

  questionsData.forEach((_, i) => {
    const c = document.createElement("div");
    c.className = "circle";
    c.innerText = i + 1;

    c.onclick = () => setCurrent(i);
    numbersEl.appendChild(c);
  });
}

function updateNumbers() {
  document.querySelectorAll(".circle").forEach((c, i) => {
    c.classList.toggle("answered", answers[i] !== undefined);
  });
}

function setCurrent(i) {
  currentIndex = i;
  document.querySelectorAll(".circle").forEach((c, idx) => {
    c.classList.toggle("current", idx === i);
  });

  const target = document.querySelector(`.question[data-index="${i}"]`);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/* ================= BUTTONS ================= */
document.getElementById("next-btn").onclick = () => {
  if (currentIndex < questionsData.length - 1) {
    setCurrent(currentIndex + 1);
  }
};

document.getElementById("prev-btn").onclick = () => {
  if (currentIndex > 0) {
    setCurrent(currentIndex - 1);
  }
};

document.getElementById("submit-btn").onclick = submitExam;

/* ================= TIMER ================= */
function startTimer() {
  updateTimer();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimer();
    if (timeLeft <= 0) submitExam();
  }, 1000);
}

function updateTimer() {
  const m = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const s = String(timeLeft % 60).padStart(2, "0");
  timerEl.innerText = `Waktu: ${m}:${s}`;
}

/* ================= SUBMIT ================= */
function submitExam() {
  clearInterval(timerInterval);

  examPage.style.display = "none";
  resultPage.style.display = "flex";

  // MODE TERANG KHUSUS HASIL
  document.body.style.background = "#f8fafc";
  document.body.style.color = "#111827";

  const answeredCount = Object.keys(answers).length;

  document.getElementById("result-text").innerHTML = `
    Terima kasih <strong>${studentName()}</strong><br>
    Jawaban terisi: <strong>${answeredCount}</strong> dari ${questionsData.length}
  `;

  sendToGoogleSheet();
}

/* ================= GOOGLE SHEET ================= */
function sendToGoogleSheet() {
  if (!window.GOOGLE_SCRIPT_URL) return;

  fetch(window.GOOGLE_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      name: studentName(),
      nim: studentNim(),
      class: studentClass(),
      answers
    }),
    mode: "no-cors"
  });
}

/* ================= HELPERS ================= */
function studentName() {
  return document.getElementById("student-name").value.trim();
}
function studentNim() {
  return document.getElementById("student-nim").value.trim();
}
function studentClass() {
  return document.getElementById("student-class").value.trim();
}
