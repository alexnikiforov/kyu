/* JC Dojo Kyiv Kyu Guide - progress storage.
   Loaded before render.js and app.js on every page.

   The site is dark-only, so there is no theme state to keep here. */

(function () {
  'use strict';

  var PREFIX = 'kyu:';

  /* ------------------------------------------------------------ storage */

  /* localStorage throws in some file:// and private-mode setups, so every
     access is guarded and falls back to an in-memory map for the session. */
  var memory = {};
  var persistent = (function () {
    try {
      var probe = PREFIX + 'probe';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  })();

  function read(key) {
    if (!persistent) return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    }
  }

  function write(key, value) {
    memory[key] = value;
    if (!persistent) return false;
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (err) {
      persistent = false;
      return false;
    }
  }

  function drop(key) {
    delete memory[key];
    if (!persistent) return;
    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      /* ignore */
    }
  }

  /* --------------------------------------------------------- checkboxes */

  var DONE_KEY = PREFIX + 'done';

  function loadDone() {
    var raw = read(DONE_KEY);
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  var done = loadDone();

  function isDone(id) {
    return done[id] === true;
  }

  function setDone(id, value) {
    if (value) {
      done[id] = true;
    } else {
      delete done[id];
    }
    write(DONE_KEY, JSON.stringify(done));
  }

  function countDone(ids) {
    var n = 0;
    for (var i = 0; i < ids.length; i += 1) {
      if (done[ids[i]] === true) n += 1;
    }
    return n;
  }

  function clearDone(ids) {
    if (!ids) {
      done = {};
    } else {
      for (var i = 0; i < ids.length; i += 1) {
        delete done[ids[i]];
      }
    }
    write(DONE_KEY, JSON.stringify(done));
  }

  /* Left over from an earlier theme toggle: clear the stale key once so it does
     not sit in localStorage forever. */
  drop(PREFIX + 'theme');

  window.KyuStore = {
    isPersistent: function () {
      return persistent;
    },
    isDone: isDone,
    setDone: setDone,
    countDone: countDone,
    clearDone: clearDone
  };
})();
