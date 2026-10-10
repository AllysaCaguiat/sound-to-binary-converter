"use strict";

// Change your displayed details in index.html before submitting.
const $ = (id) => document.getElementById(id);
const tests = [
  { name: "A", frequency: 440, amplitude: 0.8, samples: 8, bits: 3 },
  { name: "B", frequency: 200, amplitude: 0.5, samples: 6, bits: 4 },
  { name: "C", frequency: 500, amplitude: 0.9, samples: 5, bits: 3 }
];
let lastBinary = "";
let audioContext;

function wavelengthLabel(meters) {
  return meters >= 1 ? `${meters.toFixed(2)} m` : `${(meters * 100).toFixed(1)} cm`;
}

function convertWave(frequency, amplitude, samples, bits) {
  const period = 1 / frequency;
  const wavelength = 343 / frequency;
  const levels = 2 ** bits;
  const rows = [];
  for (let i = 0; i < samples; i++) {
    const time = (i * period) / samples;
    const height = amplitude * Math.sin((2 * Math.PI * i) / samples);
    // Round a half-level upward; keep values between 0 and the highest level.
    const level = Math.max(0, Math.min(levels - 1, Math.round(((height + 1) / 2) * (levels - 1))));
    const binary = level.toString(2).padStart(bits, "0");
    rows.push({ number: i + 1, timeMs: time * 1000, height, level, binary });
  }
  return {
    periodMs: period * 1000,
    wavelength: wavelengthLabel(wavelength),
    rows,
    binary: rows.map((row) => row.binary).join(" "),
    totalBits: samples * bits
  };
}

function readForm() {
  const raw = {
    frequency: $("frequency").value.trim(),
    amplitude: $("amplitude").value.trim(),
    samples: $("samples").value.trim(),
    bits: $("bits").value.trim()
  };
  const values = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Number(value)]));
  let warning = "";
  if (raw.frequency === "" || !Number.isFinite(values.frequency) || values.frequency <= 0) warning = "Frequency must be greater than 0 Hz.";
  else if (raw.amplitude === "" || !Number.isFinite(values.amplitude) || values.amplitude < 0 || values.amplitude > 1) warning = "Amplitude must be between 0 and 1.";
  else if (raw.samples === "" || !Number.isInteger(values.samples) || values.samples < 2 || values.samples > 64) warning = "Samples must be a whole number from 2 to 64.";
  else if (raw.bits === "" || !Number.isInteger(values.bits) || values.bits < 1 || values.bits > 8) warning = "Bits per sample must be a whole number from 1 to 8.";
  return { raw, values, warning };
}

function showWarning(message) {
  $("warning").textContent = message;
  $("warning").hidden = !message;
}

function renderResult(raw, values, data) {
  $("fact-amplitude").textContent = raw.amplitude;
  $("fact-frequency").textContent = `${raw.frequency} Hz`;
  $("fact-period").textContent = `${data.periodMs.toFixed(2)} ms`;
  $("fact-wavelength").textContent = data.wavelength;
  $("sample-count").textContent = `${values.samples} samples · ${2 ** values.bits} levels`;
  $("samples-body").innerHTML = data.rows.map((row) => `<tr><td>${row.number}</td><td>${row.timeMs.toFixed(2)}</td><td>${row.height.toFixed(2)}</td><td>${row.level}</td><td>${row.binary}</td></tr>`).join("");
  $("binary-output").textContent = data.binary;
  $("total-bits").textContent = data.totalBits;
  lastBinary = data.binary;
  $("results").hidden = false;
  drawWave(values.amplitude, values.samples);
}

function drawWave(amplitude, samples) {
  const canvas = $("wave-canvas");
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const padX = 28, cy = h / 2, height = (h - 56) / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#284154";
  ctx.lineWidth = 1;
  for (let y = 0; y <= 4; y++) {
    const yy = 28 + y * (h - 56) / 4;
    ctx.beginPath();ctx.moveTo(0, yy);ctx.lineTo(w, yy);ctx.stroke();
  }
  ctx.strokeStyle = "#547387";ctx.setLineDash([5, 7]);ctx.beginPath();ctx.moveTo(0, cy);ctx.lineTo(w, cy);ctx.stroke();ctx.setLineDash([]);
  const xAt = (t) => padX + t * (w - padX * 2);
  const yAt = (t) => cy - amplitude * Math.sin(2 * Math.PI * t) * height;
  ctx.strokeStyle = "#ab9afa";ctx.lineWidth = 3;ctx.beginPath();
  for (let p = 0; p <= 500; p++) {
    const t = p / 500;
    if (p === 0) ctx.moveTo(xAt(t), yAt(t)); else ctx.lineTo(xAt(t), yAt(t));
  }
  ctx.stroke();
  for (let i = 0; i < samples; i++) {
    const t = i / samples, x = xAt(t), y = yAt(t);
    ctx.strokeStyle = "#5be4d54b";ctx.lineWidth = 1;ctx.beginPath();ctx.moveTo(x, cy);ctx.lineTo(x, y);ctx.stroke();
    ctx.fillStyle = "#5be4d5";ctx.beginPath();ctx.arc(x, y, 4.5, 0, Math.PI * 2);ctx.fill();
  }
}

function renderTests() {
  $("tests-body").innerHTML = tests.map((test) => {
    const data = convertWave(test.frequency, test.amplitude, test.samples, test.bits);
    return `<tr><td>${test.name}</td><td>${test.frequency}</td><td>${test.amplitude}</td><td>${test.samples}</td><td>${test.bits}</td><td>${data.periodMs.toFixed(2)} ms</td><td>${data.wavelength}</td><td>${data.totalBits}</td><td>${data.binary}</td></tr>`;
  }).join("");
}

$("wave-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const { raw, values, warning } = readForm();
  showWarning(warning);
  if (warning) { $("results").hidden = true; return; }
  renderResult(raw, values, convertWave(values.frequency, values.amplitude, values.samples, values.bits));
});

$("copy-binary").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(lastBinary);
    $("copy-binary").textContent = "Copied!";
  } catch {
    $("copy-binary").textContent = "Select the binary line to copy";
  }
});

$("play").addEventListener("click", async () => {
  const { values, warning } = readForm();
  showWarning(warning);
  if (warning) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Audio unavailable");
    audioContext ??= new AudioContextClass();
    if (audioContext.state === "suspended") await audioContext.resume();
    if (values.frequency >= audioContext.sampleRate / 2) {
      showWarning("This frequency is too high for your device to play. Try a lower frequency.");
      return;
    }
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = values.frequency;
    const start = audioContext.currentTime;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(Math.min(values.amplitude, 1) * 0.15, start + 0.02);
    gain.gain.setValueAtTime(Math.min(values.amplitude, 1) * 0.15, start + 0.96);
    gain.gain.linearRampToValueAtTime(0, start + 1);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 1);
  } catch {
    showWarning("Sound playback is not supported in this browser.");
  }
});

renderTests();
$("wave-form").requestSubmit();
