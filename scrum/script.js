(function () {
  const synth = window.speechSynthesis;
  const voicesSelect = document.getElementById("voicesettings");
  const ttsLangSelect = document.getElementById("langsettings");
  const recogLangSelect = document.getElementById("langSelect");
  const TextArea = document.getElementById("text");

  const ClearText = document.getElementById("ClearValue");
  const WhatsHappening = document.getElementById("whatHappen");
  const startSpeechBtn = document.getElementById("startSpeech");
  const pauseSpeechBtn = document.getElementById("pauseSpeech");
  const stopSpeechBtn = document.getElementById("stopSpeech");
  const startRecBtn = document.getElementById("startRec");
  const stopRecBtn = document.getElementById("stopRec");
  WhatsHappening.textContent = "";

  if (ClearText) {
    ClearText.onclick = () => (TextArea.value = "");
  }

  // helper: add activeBtn class
  function setActive(btn, isStopBtn = false) {
    // remove activeBtn from all buttons first
    document
      .querySelectorAll(".appBtn")
      .forEach((b) => b.classList.remove("activeBtn"));
    // add to clicked one
    btn.classList.add("activeBtn");

    // if it's stopRec or stopSpeech, remove after 200ms
    if (isStopBtn) {
      setTimeout(() => btn.classList.remove("activeBtn"), 800);
    }
  }
  //ScreenPlayer: add points of what is happening
  function setHappening(content, color) {
    WhatsHappening.textContent = content;
    WhatsHappening.style.border = `4px solid ${color}`;
    WhatsHappening.style.padding = "8px";
    WhatsHappening.style.borderLeft = `7px solid ${color}`;
  }

  let currentUtterance = null;
  let recognition = null;
  let resumeRecognitionAfterTTS = false;

  // Populate voices safely
  function populateVoices() {
    const voices = synth.getVoices();
    voicesSelect.innerHTML = "";
    voices.forEach((v, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `${v.name} (${v.lang})`;
      voicesSelect.appendChild(opt);
    });
    // If no voices, keep the select empty — speech still works without choosing a voice
  }
  populateVoices();
  synth.onvoiceschanged = populateVoices;

  // Helpers to lock/unlock TTS controls (and apply pointer-events)
  function setTTSLocked(lock) {
    [startSpeechBtn, pauseSpeechBtn, stopSpeechBtn].forEach((b) => {
      b.disabled = lock;
      b.style.pointerEvents = lock ? "none" : "";
    });
  }

  // TTS: Start / Pause / Stop
  startSpeechBtn.addEventListener("click", () => {
    setActive(startSpeechBtn);
    setHappening("Speaking", "royalblue");
    const text = TextArea.value.trim();
    if (!text) {
      alert("Empty box can't speak anything");
      startSpeechBtn.classList.remove("activeBtn");
      setHappening("", "transparent");
      return;
    }

    // If we are already speaking and not paused, do nothing
    if (synth.speaking && !synth.paused) return;

    // If paused, resume
    if (synth.paused) {
      synth.resume();
      return;
    }

    // If recognition is actively listening, stop it and remember to resume after TTS
    if (recognition && recognition._listening) {
      resumeRecognitionAfterTTS = true;
      recognition._listening = false;
      recognition.stop();
    }

    const utter = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const selIndex = Number(voicesSelect.value);
    if (!Number.isNaN(selIndex) && voices[selIndex])
      utter.voice = voices[selIndex];
    utter.lang = ttsLangSelect.value || utter.lang;

    // UI lock while speaking
    utter.onstart = () => {
      TextArea.style.pointerEvents = "none";
      TextArea.style.border = "4px solid red";
    };
    utter.onend = () => {
      setActive(startSpeechBtn, true);
      setHappening("", "transparent");
      TextArea.style.pointerEvents = "";
      TextArea.style.border = "";
      currentUtterance = null;
      // Resume recognition if it was running before TTS
      if (recognition && resumeRecognitionAfterTTS) {
        resumeRecognitionAfterTTS = false;
        recognition._listening = true;
        recognition.start();
      }
    };

    currentUtterance = utter;
    synth.speak(utter);
  });

  pauseSpeechBtn.addEventListener("click", () => {
    if (synth.speaking && !synth.paused) {
      //Only activate when actually pausing
      setActive(pauseSpeechBtn);
      setHappening("Paused", "darkgray");
      synth.pause();
    } else {
      pauseSpeechBtn.classList.remove("activeBtn");
    }
  });

  stopSpeechBtn.addEventListener("click", () => {
    setActive(stopSpeechBtn, true);
    setHappening("", "transparent");
    if (synth.speaking) {
      synth.cancel();
      currentUtterance = null;
      TextArea.style.pointerEvents = "";
      TextArea.style.border = "";
    }
  });

  // --- Recognition setup ---
  // --- Recognition setup ---
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.interimResults = true;

    function addPunctuation(transcript) {
      let words = transcript.split(/\s+/);

      words = words.map((word) => {
        const lower = word.toLowerCase();
        if (lower === "comma") return ",";
        if (lower === "period" || lower === "fullstop") return ".";
        if (lower === "exclamation" || lower === "exclamationmark") return "!";
        if (lower === "question" || lower === "questionmark") return "?";
        return word;
      });

      return words.join(" ");
    }

    let finalTranscript = ""; // store only final text
    let lastFinalChunk = ""; // track last final result

    recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        let transcript = addPunctuation(event.results[i][0].transcript).trim();

        if (event.results[i].isFinal) {
          // ✅ skip duplicate final chunks
          if (transcript !== lastFinalChunk) {
            finalTranscript += transcript + " ";
            lastFinalChunk = transcript;
          }
        } else {
          interimTranscript += transcript;
        }
      }

      TextArea.value = finalTranscript + interimTranscript;
    };

    recognition.onerror = (e) => {
      console.error("Recognition error:", e);
    };

    recognition.onend = () => {
      if (recognition._listening) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (err) {
            /* ignore repeated starts */
          }
        }, 200);
      }
    };

    // Buttons
    startRecBtn.addEventListener("click", () => {
      setActive(startRecBtn);
      setHappening("Listening", "green");
      recognition.lang = recogLangSelect.value || "en-US";
      recognition._listening = true;
      try {
        recognition.start();
      } catch (err) {
        /* already started */
      }
      TextArea.style.pointerEvents = "none";
      TextArea.style.border = "4px solid green";
      setTTSLocked(true);
    });

    stopRecBtn.addEventListener("click", () => {
      setActive(stopRecBtn, true);
      setHappening("", "transparent");
      WhatsHappening.textContent = "";
      recognition._listening = false;
      try {
        recognition.stop();
      } catch (err) {}
      TextArea.style.pointerEvents = "";
      TextArea.style.border = "";
      setTTSLocked(false);
    });
  } else {
    startRecBtn.disabled = stopRecBtn.disabled = true;
  }
})();
