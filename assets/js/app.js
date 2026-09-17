/* JC Dojo Kyiv Kyu Guide - page controllers.

   Each page sets data-page on <body> and, for level pages, data-kyu.
   This file wires up the shared header, then renders the right page. */

(function () {
  'use strict';

  var R = window.KyuRender;
  var store = window.KyuStore;

  /* Simple pages (404) only load store.js + app.js, so nothing here may assume
     the renderer or the data files are present. */
  function el(tag, className, text) {
    if (R) return R.el(tag, className, text);
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  var searchInput = null;
  var unlearnedOnly = null;

  /* ------------------------------------------------------------ shared UI */

  function initStorageNotice() {
    var notice = document.querySelector('[data-storage-notice]');
    if (!notice || store.isPersistent()) return;
    notice.textContent =
      'Your browser is blocking local storage here, so ticks are kept for this ' +
      'session only. Open the site over http:// (or on GitHub Pages) to save progress.';
    notice.hidden = false;
  }

  /* ------------------------------------------------------------- progress */

  function setProgress(host, doneCount, total) {
    if (!host) return;
    var fill = host.querySelector('.progress-fill');
    var label = host.querySelector('.progress-label');
    var bar = host.querySelector('.progress-bar');
    var pct = total ? Math.round((doneCount / total) * 100) : 0;

    if (fill) {
      fill.style.width = pct + '%';
      fill.classList.toggle('is-complete', total > 0 && doneCount === total);
    }
    if (bar) {
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', String(total));
      bar.setAttribute('aria-valuenow', String(doneCount));
    }
    if (label) {
      label.textContent = doneCount + ' of ' + total + ' learned \u00B7 ' + pct + '%';
    }
  }

  function termId(term) {
    return 'term/' + term.romaji.toLowerCase();
  }

  /* Collect every checkbox id a level owns, so progress and reset agree. */
  function levelIds(level) {
    var ids = [];
    if (level.kind === 'vocabulary') {
      window.KYU_VOCABULARY.terms.forEach(function (term) {
        if (term.kyu !== level.kyu) return;
        ids.push(termId(term));
        (term.children || []).forEach(function (child) {
          ids.push(termId(term) + '/' + child.romaji.toLowerCase());
        });
      });
      return ids;
    }
    level.groups.forEach(function (group) {
      group.techniques.forEach(function (tech) {
        ids.push(tech.id);
      });
    });
    return ids;
  }

  /* -------------------------------------------------------------- filters */

  function applyFilters() {
    var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var onlyTodo = unlearnedOnly ? unlearnedOnly.checked : false;
    var items = document.querySelectorAll('.tech[data-id]');
    var visible = 0;

    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      /* Nested terms follow their parent, they are not filtered separately. */
      if (item.parentNode && item.parentNode.classList.contains('term-children')) continue;

      var show =
        (!query || item.dataset.search.indexOf(query) !== -1) &&
        (!onlyTodo || !item.classList.contains('is-done'));
      item.hidden = !show;
      if (show) visible += 1;
    }

    /* Hide a group heading when every technique inside it is filtered out. */
    var groups = document.querySelectorAll('.group');
    for (var g = 0; g < groups.length; g += 1) {
      groups[g].hidden = groups[g].querySelectorAll('.tech[data-id]:not([hidden])').length === 0;
    }

    var empty = document.querySelector('[data-empty]');
    if (empty) empty.hidden = visible !== 0;
  }

  function initToolbar() {
    searchInput = document.querySelector('[data-search]');
    unlearnedOnly = document.querySelector('[data-unlearned]');
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (unlearnedOnly) unlearnedOnly.addEventListener('change', applyFilters);
    applyFilters();
  }

  /* ------------------------------------------------------------ home page */

  function progressBlock() {
    var prog = el('div', 'progress');
    var bar = el('div', 'progress-bar');
    bar.appendChild(el('div', 'progress-fill'));
    prog.appendChild(bar);
    prog.appendChild(el('div', 'progress-label'));
    return prog;
  }

  function renderHome() {
    var list = document.querySelector('[data-level-grid]');
    if (!list) return;

    var allIds = [];

    window.KYU_TECHNIQUES.levels.forEach(function (level) {
      var ids = levelIds(level);
      allIds = allIds.concat(ids);
      var doneCount = store.countDone(ids);

      var card = el('a', 'level-card');
      card.href = level.slug + '.html';
      R.beltVars(card, level.belt);

      var top = el('div', 'top');
      top.appendChild(el('h2', null, level.ordinal + ' kyu'));
      top.appendChild(el('span', 'belt-chip', level.belt.name + ' belt'));
      if (ids.length && doneCount === ids.length) {
        top.appendChild(el('span', 'done-mark', '\u2713 done'));
      }
      card.appendChild(top);

      card.appendChild(
        el(
          'p',
          'meta',
          level.kind === 'vocabulary'
            ? (level.topLevelTerms || level.itemCount) + ' terms to learn'
            : level.itemCount + ' techniques'
        )
      );

      var prog = progressBlock();
      card.appendChild(prog);
      setProgress(prog, doneCount, ids.length);

      var li = el('li');
      li.appendChild(card);
      list.appendChild(li);
    });

    setProgress(
      document.querySelector('[data-overall-progress]'),
      store.countDone(allIds),
      allIds.length
    );

    var resetAll = document.querySelector('[data-reset-all]');
    if (resetAll) {
      resetAll.addEventListener('click', function () {
        if (!window.confirm('Clear your progress on every kyu level?')) return;
        store.clearDone(null);
        window.location.reload();
      });
    }
  }

  /* ---------------------------------------------------------- level pages */

  function groupSection(group, refresh) {
    var section = el('section', 'group');

    var gh = el('div', 'group-head');
    var h2 = el('h2', null, group.romaji + ' ');
    if (group.kanji) {
      var jp = el('span', 'jp', group.kanji);
      jp.lang = 'ja';
      h2.appendChild(jp);
    }
    gh.appendChild(h2);

    var count = group.techniques.length;
    var en = el(
      'span',
      'en',
      group.en + ' \u00B7 ' + count + (count === 1 ? ' technique' : ' techniques')
    );
    if (group.parent) {
      en.appendChild(el('span', 'parent', ' \u00B7 part of ' + group.parent));
    }
    gh.appendChild(en);
    section.appendChild(gh);

    var ul = el('ul', 'tech-list');
    group.techniques.forEach(function (tech) {
      ul.appendChild(R.techniqueItem(tech, refresh));
    });
    section.appendChild(ul);
    return section;
  }

  function renderLevel(kyu) {
    var level = R.levelById(kyu);
    if (!level) return;

    var head = document.querySelector('[data-page-head]');
    if (head) R.beltVars(head, level.belt);

    var progressHost = document.querySelector('[data-level-progress]');
    var ids = levelIds(level);

    function refresh() {
      setProgress(progressHost, store.countDone(ids), ids.length);
      applyFilters();
    }

    var host = document.querySelector('[data-groups]');
    if (host) {
      level.groups.forEach(function (group) {
        host.appendChild(groupSection(group, refresh));
      });
    }

    var termHost = document.querySelector('[data-terms]');
    if (termHost) {
      window.KYU_VOCABULARY.terms.forEach(function (term) {
        if (term.kyu !== kyu) return;
        var id = termId(term);
        var li = R.termRow(term, id, refresh, true);
        var kids = term.children || [];
        if (kids.length) {
          var sub = el('ul', 'term-children');
          kids.forEach(function (child) {
            sub.appendChild(
              R.termRow(child, id + '/' + child.romaji.toLowerCase(), refresh, true)
            );
          });
          li.appendChild(sub);
        }
        termHost.appendChild(li);
      });
    }

    initToolbar();
    setProgress(progressHost, store.countDone(ids), ids.length);

    var reset = document.querySelector('[data-reset-level]');
    if (reset) {
      reset.addEventListener('click', function () {
        if (!window.confirm('Clear your progress for ' + level.ordinal + ' kyu?')) return;
        store.clearDone(ids);
        window.location.reload();
      });
    }
  }

  /* ------------------------------------------------------- glossary page */

  function renderGlossary() {
    var host = document.querySelector('[data-glossary]');
    if (!host) return;

    var rows = [];
    window.KYU_VOCABULARY.terms.forEach(function (term) {
      rows.push({ term: term, id: termId(term) });
      (term.children || []).forEach(function (child) {
        rows.push({ term: child, id: termId(term) + '/' + child.romaji.toLowerCase() });
      });
    });

    rows.sort(function (a, b) {
      return a.term.romaji.localeCompare(b.term.romaji);
    });

    var ids = rows.map(function (row) {
      return row.id;
    });
    var progressHost = document.querySelector('[data-level-progress]');

    function refresh() {
      setProgress(progressHost, store.countDone(ids), ids.length);
      applyFilters();
    }

    rows.forEach(function (row) {
      host.appendChild(R.termRow(row.term, row.id, refresh, true));
    });

    initToolbar();
    setProgress(progressHost, store.countDone(ids), ids.length);

    var reset = document.querySelector('[data-reset-level]');
    if (reset) {
      reset.addEventListener('click', function () {
        if (!window.confirm('Clear your progress on all vocabulary terms?')) return;
        store.clearDone(ids);
        window.location.reload();
      });
    }
  }

  /* ---------------------------------------------------------------- boot */

  function boot() {
    initStorageNotice();

    var page = document.body.dataset.page;
    if (page === 'home') {
      renderHome();
    } else if (page === 'level') {
      renderLevel(parseInt(document.body.dataset.kyu, 10));
    } else if (page === 'glossary') {
      renderGlossary();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
