/*
 * Ponte de sincronização do Simulador Tributário (SN x Reforma).
 *
 * O bundle (/simulador-sn-reforma.html) é a "versão local": sobrescreve o fetch
 * e guarda as simulações em localStorage (chave `statos.simulador.local.v1`) na
 * forma [{ id, nome, cnpj, versoes: [{ id, versao, dados, criadoEm }] }].
 *
 * Este script NÃO toca no bundle. Ele apenas:
 *   1. Ao abrir: busca as simulações do usuário no nosso Supabase
 *      (GET /api/simulador/sync) e hidrata o localStorage, chamando o hook que
 *      o bundle expõe (window.__statosLocalAtualizar) para atualizar a lista.
 *   2. A cada save: intercepta localStorage.setItem e replica o conjunto para o
 *      servidor (POST /api/simulador/sync).
 *
 * A rota /api/simulador/* NÃO é interceptada pelo fetch-mock do bundle (ele só
 * pega /api/simulacoes e /api/cnpj), então cai no fetch real (mesma origem,
 * cookies de auth do PROGPT viajam junto). Tudo fail-soft: sem rede/deslogado,
 * o simulador segue funcionando só com o localStorage.
 */
(function () {
  'use strict';

  var KEY = 'statos.simulador.local.v1';
  var SYNC_URL = '/api/simulador/sync';

  // fetch atual (o override do bundle repassa nosso path pro fetch real).
  var doFetch = window.fetch.bind(window);

  var suppressMirror = false; // não reenviar a escrita da própria hidratação
  var mirrorTimer = null;

  function safeGet() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  // ---- 1. Espelhar cada save (escrita no localStorage) para o servidor ----
  var origSetItem;
  try {
    origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      origSetItem(k, v);
      if (k === KEY && !suppressMirror) {
        if (mirrorTimer) clearTimeout(mirrorTimer);
        // debounce: o bundle pode escrever em rajada num único save
        mirrorTimer = setTimeout(function () {
          mirror(v);
        }, 400);
      }
    };
  } catch (e) {
    // localStorage indisponível (modo privado) — sem sync, sem quebrar nada.
  }

  function mirror(value) {
    var clientes;
    try {
      clientes = JSON.parse(value);
    } catch (e) {
      return;
    }
    if (!Array.isArray(clientes)) return;
    doFetch(SYNC_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientes),
    }).catch(function () {
      /* fail-soft: reenvia no próximo save */
    });
  }

  // ---- 2. Hidratar o localStorage a partir do servidor ao abrir -----------
  function hydrate() {
    return doFetch(SYNC_URL, { credentials: 'same-origin' })
      .then(function (r) {
        return r && r.ok ? r.json() : null;
      })
      .then(function (clientes) {
        if (!Array.isArray(clientes)) return;
        // Não sobrescreve se o servidor está vazio mas há algo local ainda não
        // sincronizado (ex.: primeiro uso offline) — nesse caso, espelha o local.
        if (clientes.length === 0) {
          var local = safeGet();
          if (local && local !== '[]') {
            mirror(local);
            return;
          }
        }
        suppressMirror = true;
        try {
          localStorage.setItem(KEY, JSON.stringify(clientes));
        } catch (e) {
          /* ignore */
        } finally {
          suppressMirror = false;
        }
        if (typeof window.__statosLocalAtualizar === 'function') {
          window.__statosLocalAtualizar();
        }
      })
      .catch(function () {
        /* fail-soft: segue com o localStorage atual */
      });
  }

  // Espera o bundle montar (expõe __statosLocalAtualizar) e então hidrata.
  function boot(tries) {
    if (typeof window.__statosLocalAtualizar === 'function' || tries <= 0) {
      hydrate();
    } else {
      setTimeout(function () {
        boot(tries - 1);
      }, 150);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    boot(40);
  } else {
    window.addEventListener('DOMContentLoaded', function () {
      boot(40);
    });
  }
})();
