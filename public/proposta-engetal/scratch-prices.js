/* Raspadinha visual: valores e cálculos continuam no HTML/app.js. */
(() => {
  'use strict';
  const section = document.querySelector('main');
  if (!section || !window.PointerEvent || !window.ResizeObserver) return;
  const cards = new Set();
  let revealAll = false;
  const help = document.createElement('p');
  help.className = 'scratch-help';
  help.textContent = 'Raspe os valores com o mouse ou o dedo para revelar.';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'scratch-reveal-all';
  button.textContent = 'Revelar todos os valores';
  const anchor = section.querySelector('#plans') || section.querySelector('.setup');
  if (!anchor) return;
  anchor.before(help, button);
  button.addEventListener('click', () => {
    revealAll = true;
    cards.forEach(card => card.reveal());
    button.textContent = 'Todos os valores revelados';
    button.setAttribute('aria-pressed', 'true');
  });
  function initialize() {
    section.querySelectorAll('.setup strong, #plans .plan > strong, #personCost, #humanUnit, #aiUnit, #costSaving, #savedHours, #returnValue, #returnRatio, #retorno .line > b, #scenarios td:not(:first-child), #annual b, #annual strong').forEach(price => {
      if (price.closest('.scratch-price') || price.querySelector('.scratch-price')) return;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', {willReadFrequently: true});
      if (!ctx) return;
      const wrap = document.createElement(price.tagName === 'TD' ? 'span' : 'div');
      wrap.className = 'scratch-price';
      if (price.tagName === 'TD') {
        const value = document.createElement('span');
        value.append(...price.childNodes);
        price.append(wrap);
        wrap.append(value, canvas);
      } else {
        price.before(wrap);
        wrap.append(price, canvas);
      }
      canvas.setAttribute('aria-hidden', 'true');
      let revealed = false, active = null, previous = null;
      let width = 0, height = 0;
      const strokes = [];
      const reveal = () => {
        revealed = true;
        wrap.classList.add('is-revealed');
        observer.disconnect();
      };
      const erase = (a, b) => {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 36;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width + .01, b.y * height + .01);
        ctx.stroke();
      };
      function draw() {
        if (revealed) return;
        const rect = wrap.getBoundingClientRect();
        width = rect.width; height = rect.height;
        if (!width || !height) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#8ea6b9');
        gradient.addColorStop(.48, '#d4e1e9');
        gradient.addColorStop(1, '#7893a8');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(255,255,255,.17)';
        ctx.lineWidth = 1;
        for (let x = -height; x < width; x += 7) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + height, height); ctx.stroke();
        }
        ctx.textAlign = 'center';
        ctx.fillStyle = '#183247';
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.fillText('Raspe para revelar', width / 2, height / 2 + 5);
        strokes.forEach(([a,b]) => erase(a,b));
      }
      const observer = new ResizeObserver(draw);
      observer.observe(wrap);
      const point = event => {
        const rect = canvas.getBoundingClientRect();
        return {x:(event.clientX - rect.left)/rect.width,y:(event.clientY - rect.top)/rect.height};
      };
      canvas.addEventListener('pointerdown', event => {
        if (active !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault(); event.stopPropagation();
        active = event.pointerId;
        canvas.setPointerCapture(active);
        previous = point(event);
        strokes.push([previous,previous]); erase(previous,previous);
      });
      canvas.addEventListener('pointermove', event => {
        if (event.pointerId !== active) return;
        event.preventDefault(); event.stopPropagation();
        const next = point(event);
        strokes.push([previous,next]); erase(previous,next); previous = next;
      });
      const finish = event => {
        if (event.pointerId !== active) return;
        event.stopPropagation();
        active = null;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data;
        let cleared = 0, samples = 0;
        for (let i = 3; i < pixels.length; i += 64) { samples++; if (pixels[i] < 128) cleared++; }
        if (samples && cleared / samples >= .38) reveal();
      };
      canvas.addEventListener('pointerup', finish);
      canvas.addEventListener('pointercancel', finish);
      canvas.addEventListener('click', event => {event.preventDefault();event.stopPropagation();});
      cards.add({reveal});
      if (revealAll) reveal();
    });
  }
  for (const id of ['comparacao', 'retorno']) {
    const target = document.querySelector('#' + id + ' .inputs');
    if (!target) continue;
    const hint = help.cloneNode(true);
    const control = button.cloneNode(true);
    control.addEventListener('click', () => {
      button.click();
      control.textContent = 'Todos os valores revelados';
    });
    target.after(hint, control);
  }
  initialize();
  new MutationObserver(initialize).observe(section, {childList:true,subtree:true});
})();
