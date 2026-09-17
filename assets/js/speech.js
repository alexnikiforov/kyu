/* Judo Kyu Guide - Japanese pronunciation via the Web Speech API.

   Speaks the kanji when available, because a ja-JP voice reads kanji with the
   correct pitch and vowel length. Romaji is only a fallback: an English voice
   reading romaji sounds wrong, so if there is no Japanese voice at all we
   disable the buttons rather than mispronounce the terms. */

(function () {
  'use strict';

  var synth = window.speechSynthesis || null;
  var supported = !!(synth && window.SpeechSynthesisUtterance);
  var voice = null;
  var current = null;

  function pickVoice() {
    if (!supported) return null;
    var voices = synth.getVoices() || [];
    var exact = null;
    var loose = null;
    for (var i = 0; i < voices.length; i += 1) {
      var lang = (voices[i].lang || '').toLowerCase().replace('_', '-');
      if (lang === 'ja-jp') {
        if (!exact) exact = voices[i];
      } else if (lang.indexOf('ja') === 0) {
        if (!loose) loose = voices[i];
      }
    }
    voice = exact || loose || null;
    return voice;
  }

  if (supported) {
    pickVoice();
    /* Voices load asynchronously in Chrome, so refresh when they arrive. */
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', function () {
        pickVoice();
        document.dispatchEvent(new CustomEvent('kyu:voiceschanged'));
      });
    }
  }

  function hasVoice() {
    if (!supported) return false;
    if (!voice) pickVoice();
    return !!voice;
  }

  function stop() {
    if (!supported) return;
    try {
      synth.cancel();
    } catch (err) {
      /* ignore */
    }
    current = null;
  }

  /* Speak a term. `opts.onstart` / `opts.onend` drive button state. */
  function speak(kanji, romaji, opts) {
    var options = opts || {};
    if (!supported) return false;

    var text = kanji || romaji || '';
    if (!text) return false;

    stop();

    var utter = new window.SpeechSynthesisUtterance(text);
    utter.lang = 'ja-JP';
    if (!voice) pickVoice();
    if (voice) utter.voice = voice;
    /* Slightly slower than default: these are drill terms, clarity wins. */
    utter.rate = 0.85;
    utter.pitch = 1;

    utter.onstart = function () {
      current = utter;
      if (options.onstart) options.onstart();
    };
    utter.onend = utter.onerror = function () {
      current = null;
      if (options.onend) options.onend();
    };

    try {
      synth.speak(utter);
      return true;
    } catch (err) {
      current = null;
      if (options.onend) options.onend();
      return false;
    }
  }

  window.KyuSpeech = {
    isSupported: function () {
      return supported;
    },
    hasJapaneseVoice: hasVoice,
    isSpeaking: function () {
      return !!current;
    },
    speak: speak,
    stop: stop
  };
})();
