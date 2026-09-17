/* Judo Kyu Guide - DOM builders.
   Everything is built with createElement/textContent, never innerHTML. */

(function () {
  'use strict';

  var YT_WATCH = 'https://www.youtube.com/watch?v=';
  var YT_EMBED = 'https://www.youtube-nocookie.com/embed/';

  /* Embeds are blocked by the browser on file://, so only show plain links. */
  var IS_FILE = window.location.protocol === 'file:';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null && text !== '') node.textContent = text;
    return node;
  }

  function levelById(kyu) {
    var levels = window.KYU_TECHNIQUES ? window.KYU_TECHNIQUES.levels : [];
    for (var i = 0; i < levels.length; i += 1) {
      if (levels[i].kyu === kyu) return levels[i];
    }
    return null;
  }

  function beltVars(node, belt) {
    node.style.setProperty('--belt', belt.hex);
    node.style.setProperty('--belt-text', belt.text);
  }

  /* --------------------------------------------------------- speak button */

  function speakButton(kanji, romaji) {
    var speech = window.KyuSpeech;
    var btn = el('button', 'act act-speak');
    btn.type = 'button';
    btn.appendChild(el('span', null, '\uD83D\uDD0A'));
    btn.appendChild(el('span', null, 'Say it'));

    var label = 'Pronounce ' + romaji + ' in Japanese';
    btn.setAttribute('aria-label', label);

    function refresh() {
      if (!speech || !speech.isSupported()) {
        btn.disabled = true;
        btn.title = 'Your browser does not support speech synthesis';
      } else if (!speech.hasJapaneseVoice()) {
        btn.disabled = true;
        btn.title = 'No Japanese voice installed on this device';
      } else {
        btn.disabled = false;
        btn.title = label;
      }
    }
    refresh();
    document.addEventListener('kyu:voiceschanged', refresh);

    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (!speech || btn.disabled) return;
      speech.speak(kanji, romaji, {
        onstart: function () {
          btn.classList.add('is-speaking');
        },
        onend: function () {
          btn.classList.remove('is-speaking');
        }
      });
    });

    return btn;
  }

  /* --------------------------------------------------------- video parts */

  function videoLink(videoId, text) {
    var a = el('a', 'act act-video');
    a.href = YT_WATCH + videoId;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.appendChild(el('span', null, '\u25B6'));
    a.appendChild(el('span', null, text));
    return a;
  }

  /* The iframe is only created on first click, so a page with 30 techniques
     does not load 30 YouTube players. */
  function embedToggle(videoId, romaji, host) {
    var btn = el('button', 'act act-embed');
    btn.type = 'button';
    btn.appendChild(el('span', null, 'Watch here'));
    btn.setAttribute('aria-expanded', 'false');

    var built = false;
    btn.addEventListener('click', function () {
      var open = host.hidden;
      if (open && !built) {
        var frame = el('div', 'embed-frame');
        var iframe = document.createElement('iframe');
        iframe.src = YT_EMBED + videoId + '?rel=0';
        iframe.title = romaji + ' - Kodokan demonstration';
        iframe.loading = 'lazy';
        iframe.allow = 'accelerometer; clipboard-write; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        frame.appendChild(iframe);
        host.appendChild(frame);
        built = true;
      }
      host.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.firstChild.textContent = open ? 'Hide video' : 'Watch here';
    });

    return btn;
  }

  /* ------------------------------------------------------ technique card */

  function techniqueItem(tech, onToggle) {
    var store = window.KyuStore;
    var li = el('li', 'tech');
    li.id = 't-' + tech.id.replace(/\//g, '--');
    li.dataset.id = tech.id;
    /* Lowercased haystack for the search box. */
    li.dataset.search = [tech.romaji, tech.en, tech.kanji, tech.alsoKnownAs || '']
      .join(' ')
      .toLowerCase();

    var main = el('div', 'tech-main');

    var check = el('input', 'tech-check');
    check.type = 'checkbox';
    check.checked = store.isDone(tech.id);
    check.setAttribute('aria-label', 'Mark ' + tech.romaji + ' as learned');
    main.appendChild(check);

    var body = el('div', 'tech-body');
    var name = el('div', 'tech-name');

    var romajiLabel = el('label', 'tech-romaji', tech.romaji);
    romajiLabel.htmlFor = check.id = 'c-' + li.id;
    name.appendChild(romajiLabel);

    if (tech.kanji) {
      var kanji = el('span', 'tech-kanji', tech.kanji);
      kanji.lang = 'ja';
      name.appendChild(kanji);
    }
    if (tech.variant) {
      name.appendChild(el('span', 'badge badge-variant', 'Variant ' + tech.variant));
    }
    body.appendChild(name);

    if (tech.en) body.appendChild(el('span', 'tech-en', tech.en));
    if (tech.alsoKnownAs) {
      body.appendChild(el('span', 'tech-aka', 'Also known as: ' + tech.alsoKnownAs));
    }

    var actions = el('div', 'tech-actions');
    actions.appendChild(speakButton(tech.kanji, tech.romaji));

    var embedHost = el('div', 'tech-embed');
    embedHost.hidden = true;

    var video = tech.video || {};
    if (video.id) {
      actions.appendChild(videoLink(video.id, 'Kodokan video'));
      if (!IS_FILE) {
        actions.appendChild(embedToggle(video.id, tech.romaji, embedHost));
      }
      if (video.match === 'related' && video.relatedTo) {
        actions.appendChild(
          el('span', 'badge badge-related', 'closest match: ' + video.relatedTo)
        );
      }
    } else {
      actions.appendChild(el('span', 'badge badge-related', 'no video available'));
    }

    if (tech.escapeVideo) {
      actions.appendChild(videoLink(tech.escapeVideo, 'Escapes'));
    }

    body.appendChild(actions);
    main.appendChild(body);
    li.appendChild(main);
    li.appendChild(embedHost);

    function sync() {
      li.classList.toggle('is-done', check.checked);
    }
    sync();

    check.addEventListener('change', function () {
      store.setDone(tech.id, check.checked);
      sync();
      if (onToggle) onToggle();
    });

    return li;
  }

  /* ----------------------------------------------------------- term card */

  function termRow(term, id, onToggle, withMeaning) {
    var store = window.KyuStore;
    var li = el('li', 'tech term');
    li.dataset.id = id;
    li.dataset.search = [term.romaji, term.en, term.kanji, term.meaning || '']
      .join(' ')
      .toLowerCase();

    var main = el('div', 'tech-main');

    var check = el('input', 'tech-check');
    check.type = 'checkbox';
    check.id = 'c-' + id.replace(/\//g, '--');
    check.checked = store.isDone(id);
    check.setAttribute('aria-label', 'Mark ' + term.romaji + ' as learned');
    main.appendChild(check);

    var body = el('div', 'tech-body');
    var name = el('div', 'tech-name');

    var label = el('label', 'tech-romaji', term.romaji);
    label.htmlFor = check.id;
    name.appendChild(label);

    if (term.kanji) {
      var kanji = el('span', 'tech-kanji', term.kanji);
      kanji.lang = 'ja';
      name.appendChild(kanji);
    }
    if (term.syllables) {
      name.appendChild(el('span', 'term-syllables', term.syllables));
    }
    body.appendChild(name);

    if (term.en) body.appendChild(el('span', 'tech-en', term.en));
    if (withMeaning && term.meaning) {
      body.appendChild(el('p', 'term-meaning', term.meaning));
    }

    var actions = el('div', 'tech-actions');
    actions.appendChild(speakButton(term.kanji, term.romaji));
    body.appendChild(actions);

    main.appendChild(body);
    li.appendChild(main);

    function sync() {
      li.classList.toggle('is-done', check.checked);
    }
    sync();

    check.addEventListener('change', function () {
      store.setDone(id, check.checked);
      sync();
      if (onToggle) onToggle();
    });

    return li;
  }

  window.KyuRender = {
    el: el,
    levelById: levelById,
    techniqueItem: techniqueItem,
    termRow: termRow,
    beltVars: beltVars,
    speakButton: speakButton,
    videoLink: videoLink,
    embedToggle: embedToggle,
    isFile: IS_FILE,
    YT_WATCH: YT_WATCH
  };
})();
