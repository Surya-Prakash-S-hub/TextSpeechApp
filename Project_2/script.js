(function () {
  const synth = window.speechSynthesis;
  const voicesSelect = document.getElementById("voicesettings");
  const ttsLangSelect = document.getElementById("langsettings");
  const recogLangSelect = document.getElementById("langSelect");
  const TextArea = document.getElementById("text");

  const ClearText = document.getElementById("ClearValue");
  const startSpeechBtn = document.getElementById("startSpeech");
  const pauseSpeechBtn = document.getElementById("pauseSpeech");
  const stopSpeechBtn = document.getElementById("stopSpeech");
  const startRecBtn = document.getElementById("startRec");
  const stopRecBtn = document.getElementById("stopRec");

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
      setTimeout(() => btn.classList.remove("activeBtn"), 1700);
    }
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
    const text = TextArea.value.trim();
    if (!text) {
      alert("Empty box can't speak anything");
      startSpeechBtn.classList.remove("activeBtn");
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
      TextArea.style.border = "2px solid red";
    };
    utter.onend = () => {
      setActive(startSpeechBtn, true);
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
      synth.pause();
    } else {
      pauseSpeechBtn.classList.remove("activeBtn");
    }
  });

  stopSpeechBtn.addEventListener("click", () => {
    setActive(stopSpeechBtn, true);
    if (synth.speaking) {
      synth.cancel();
      currentUtterance = null;
      TextArea.style.pointerEvents = "";
      TextArea.style.border = "";
    }
  });

  // --- Recognition setup ---
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.interimResults = true;

    function addPunctuation(transcript) {
      // Split transcript into words
      let words = transcript.split(/\s+/);

      // Replace only if the word is *alone*
      words = words.map((word) => {
        const lower = word.toLowerCase();
        if (lower === "comma") return ",";
        if (lower === "period" || lower === "full" || lower === "stop")
          return ".";
        if (lower === "exclamation" || lower === "exclamationmark") return "!";
        if (lower === "question" || lower === "questionmark") return "?";
        return word; // keep original
      });

      // Join words back into sentence
      return words.join(" ");
    }

    recognition.onresult = (e) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          transcript += e.results[i][0].transcript.trim() + " ";
        }
      }

      if (transcript) {
        transcript = addPunctuation(transcript);
        // Capitalize first letter of sentence
        transcript = transcript.charAt(0).toUpperCase() + transcript.slice(1);
        TextArea.value += transcript + " ";
      }
    };

    // If recognition ends by itself, restart when _listening is true (keeps it continuous)
    recognition.onend = () => {
      if (recognition._listening) {
        // small delay before restarting (avoid rapid restart loops)
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
      recognition.lang = recogLangSelect.value || "en-US";
      recognition._listening = true;
      try {
        recognition.start();
      } catch (err) {
        /* already started */
      }
      TextArea.style.pointerEvents = "none";
      TextArea.style.border = "2px solid green";
      setTTSLocked(true); // disable TTS buttons while listening
    });

    stopRecBtn.addEventListener("click", () => {
      setActive(stopRecBtn, true);
      recognition._listening = false;
      try {
        recognition.stop();
      } catch (err) {}
      TextArea.style.pointerEvents = "";
      TextArea.style.border = "";
      setTTSLocked(false); // re-enable TTS buttons
    });
  } else {
    // Browser doesn't support recognition
    startRecBtn.disabled = stopRecBtn.disabled = true;
  }
})();
