/* ─────────────────────────────────────────────
   황승하 · 파이트 레주메

   모듈 단위로 나눠 각자 자기 마크업만 찾는다.
   해당 마크업이 없는 페이지에서는 조용히 넘어간다.

   외부 애니메이션 라이브러리를 쓰지 않는다.
   스크립트가 안 떠도 내용은 그대로 보인다.
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover)').matches;

  /* ── 움직임의 범위 ───────────────────────
     연출은 히어로에만 둔다. 그 아래는 스캔하는 영역이라
     스크롤할 때마다 요소가 떠오르면 읽는 속도만 느려진다.
     관성 스크롤도 쓰지 않는다. 페이지 전체에 걸려서
     히어로에만 적용할 수 없다.
     ──────────────────────────────────────── */

  /* ── 스크롤 등장 ─────────────────────────── */
  var Reveal = {
    init: function () {
      // 아래 섹션은 기다리지 않고 바로 보여준다
      document.querySelectorAll('.reveal, .rise').forEach(function (el) {
        el.classList.add('is-in');
      });
      this.setCounts();
      this.fillAll();
    },

    setCounts: function () {
      document.querySelectorAll('[data-count]').forEach(function (n) {
        n.textContent = n.dataset.count;
      });
    },

    fillAll: function () {
      document.querySelectorAll('.breakdown__bar i').forEach(function (b) {
        b.style.width = b.dataset.fill + '%';
      });
    }
  };

  /* ── 상단 바 + 히어로 ────────────────────── */
  var Hero = {
    init: function () {
      var bar = document.getElementById('topbar');
      var hero = document.querySelector('.hero');

      if (bar && !hero) bar.classList.add('topbar--pinned');
      if (!hero) return;

      var bg = hero.querySelector('.hero__bg');
      var video = hero.querySelector('.hero__bg video');
      var ticking = false;

      function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          var y = window.scrollY;
          if (bg && !reduced) bg.style.transform = 'translateY(' + (y * 0.3) + 'px)';
          if (bar) bar.classList.toggle('is-on', y > hero.offsetHeight * 0.7);
          ticking = false;
        });
      }

      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();

      if (!video) return;

      // 무음이어야 자동 재생이 허용된다
      video.muted = true;
      video.addEventListener('canplay', function () { bg.classList.add('is-ready'); });
      video.play().catch(function () { /* 막히면 포스터가 남는다 */ });

      // 화면 밖으로 나가면 멈춘다. 배터리와 데이터를 쓸 이유가 없다.
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (e.isIntersecting) video.play().catch(function () {});
            else video.pause();
          });
        }, { threshold: 0.1 }).observe(hero);
      }

      var soundBtn = hero.querySelector('[data-hero-sound]');
      if (soundBtn) {
        soundBtn.addEventListener('click', function () {
          video.muted = !video.muted;
          soundBtn.textContent = video.muted ? '♪' : '♫';
          soundBtn.setAttribute('aria-label', video.muted ? '소리 켜기' : '소리 끄기');
          if (!video.muted) Bgm.stop();
        });
      }
    }
  };

  /* ── 호버 미리보기 ───────────────────────── */
  // 카드에 마우스를 올리면 2.5초 클립이 돈다.
  // preload="none" 이라 올리기 전에는 내려받지 않는다.
  var HoverPreview = {
    init: function () {
      if (!canHover || reduced) return;

      document.querySelectorAll('[data-preview]').forEach(function (card) {
        var video = card.querySelector('video');
        if (!video) return;

        var bar = card.querySelector('[data-preview-progress]');
        var raf = null;
        var enterTimer = null;

        function tick() {
          if (bar && video.duration) {
            bar.style.width = (video.currentTime / video.duration * 100) + '%';
          }
          raf = requestAnimationFrame(tick);
        }

        function start() {
          // 스쳐 지나가는 마우스에는 반응하지 않는다
          enterTimer = setTimeout(function () {
            video.currentTime = 0;
            var p = video.play();
            if (p) p.then(function () {
              card.classList.add('is-previewing');
              raf = requestAnimationFrame(tick);
            }).catch(function () {});
          }, 120);
        }

        function stop() {
          clearTimeout(enterTimer);
          cancelAnimationFrame(raf);
          video.pause();
          video.currentTime = 0;
          card.classList.remove('is-previewing');
          if (bar) bar.style.width = '0%';
        }

        card.addEventListener('mouseenter', start);
        card.addEventListener('mouseleave', stop);
        card.addEventListener('focusin', start);
        card.addEventListener('focusout', stop);
      });
    }
  };

  /* ── BGM ─────────────────────────────────── */
  var Bgm = {
    init: function () {
      var audio = document.getElementById('bgm');
      var btn = document.getElementById('bgmBtn');
      if (!audio || !btn) return;

      this.audio = audio;
      this.btn = btn;
      this.label = btn.querySelector('[data-bgm-label]');

      var self = this;
      btn.addEventListener('click', function () {
        if (audio.paused) self.start(false);
        else self.stop();
      });

      if (this.remember() === 'on') this.start(true);

      // 영상 소리가 나면 BGM 을 멈춘다. 겹치면 둘 다 못 듣는다.
      document.addEventListener('play', function (e) {
        if (e.target.tagName === 'VIDEO' && !e.target.muted) self.stop();
      }, true);
    },

    start: function (quiet) {
      if (!this.audio) return;
      var self = this;
      this.audio.volume = 0.35;
      this.audio.play().then(function () {
        self.btn.classList.add('is-playing');
        self.btn.setAttribute('aria-pressed', 'true');
        if (self.label) self.label.textContent = 'BGM ON';
        self.remember('on');
      }).catch(function () {
        if (!quiet && self.label) self.label.textContent = '재생 불가';
      });
    },

    stop: function () {
      if (!this.audio || this.audio.paused) return;
      this.audio.pause();
      this.btn.classList.remove('is-playing');
      this.btn.setAttribute('aria-pressed', 'false');
      if (this.label) this.label.textContent = 'BGM';
      this.remember('off');
    },

    remember: function (v) {
      try {
        if (v === undefined) return sessionStorage.getItem('bgm');
        sessionStorage.setItem('bgm', v);
      } catch (e) { /* 저장소가 막힌 환경 */ }
    }
  };

  /* ── 영상 슬라이더 ───────────────────────── */
  var Slider = {
    init: function () {
      document.querySelectorAll('[data-slider]').forEach(function (track) {
        var id = track.dataset.slider;
        var prev = document.querySelector('[data-slider-prev="' + id + '"]');
        var next = document.querySelector('[data-slider-next="' + id + '"]');
        var bar = document.querySelector('[data-slider-progress="' + id + '"]');

        function step() {
          var card = track.querySelector('.video-card');
          return card ? card.offsetWidth + 16 : track.clientWidth * 0.8;
        }

        function progress() {
          if (!bar) return;
          var max = track.scrollWidth - track.clientWidth;
          var ratio = track.clientWidth / track.scrollWidth;
          var pos = max > 0 ? track.scrollLeft / max : 0;
          bar.style.width = (ratio * 100) + '%';
          bar.style.transform = 'translateX(' + (pos * (100 / ratio - 100)) + '%)';
        }

        track.addEventListener('scroll', progress, { passive: true });
        window.addEventListener('resize', progress);
        progress();

        if (prev) prev.addEventListener('click', function () {
          track.scrollBy({ left: -step(), behavior: 'smooth' });
        });
        if (next) next.addEventListener('click', function () {
          track.scrollBy({ left: step(), behavior: 'smooth' });
        });

        // 마우스로 끌어서 넘기기
        var down = false, startX = 0, startLeft = 0, moved = 0;

        track.addEventListener('mousedown', function (e) {
          down = true; moved = 0;
          startX = e.pageX;
          startLeft = track.scrollLeft;
          track.classList.add('is-dragging');
        });

        window.addEventListener('mousemove', function (e) {
          if (!down) return;
          var d = e.pageX - startX;
          moved = Math.abs(d);
          track.scrollLeft = startLeft - d;
          if (moved > 4) e.preventDefault();
        });

        window.addEventListener('mouseup', function () {
          if (!down) return;
          down = false;
          track.classList.remove('is-dragging');
        });

        // 끌던 중이었다면 링크 이동을 막는다
        track.addEventListener('click', function (e) {
          if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
        }, true);
      });
    }
  };

  /* ── 부채 ────────────────────────────────── */
  // 카드가 한 점을 축으로 벌어져 있다. 가운데 것만 또렷하고
  // 멀어질수록 눕고 어두워진다. 누르면 갤러리로 간다.
  var Fan = {
    init: function () {
      var stage = document.querySelector('[data-fan]');
      if (!stage) return;

      var cards = Array.prototype.slice.call(stage.querySelectorAll('.fan__card'));
      if (!cards.length) return;

      var counter = document.querySelector('[data-fan-count]');
      var prev = document.querySelector('[data-fan-prev]');
      var next = document.querySelector('[data-fan-next]');
      var index = Math.floor(cards.length / 2);

      // 넓은 화면에서는 카드가 옆으로 벌어져 양옆 두 장까지만 들어간다
      function wide() { return window.matchMedia('(min-width: 1000px)').matches; }

      function render() {
        cards.forEach(function (card, i) {
          var o = i - index;
          card.style.setProperty('--o', o);
          card.style.setProperty('--a', Math.abs(o));
          card.classList.toggle('is-active', o === 0);
          // 화면이 좁으면 겹쳐서 안 보이므로 일찍 지운다.
          card.classList.toggle('is-far', Math.abs(o) > (wide() ? 2 : 3));
          card.setAttribute('aria-hidden', o === 0 ? 'false' : 'true');
        });
        if (counter) counter.innerHTML = '<b>' + (index + 1) + '</b> / ' + cards.length;
      }

      function move(d) {
        index = Math.min(cards.length - 1, Math.max(0, index + d));
        render();
      }

      cards.forEach(function (card, i) {
        card.addEventListener('click', function (e) {
          // 가운데가 아니면 먼저 가운데로 끌어온다
          if (i !== index) {
            e.preventDefault();
            index = i;
            render();
          }
        });
      });

      if (prev) prev.addEventListener('click', function () { move(-1); });
      if (next) next.addEventListener('click', function () { move(1); });

      stage.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
      });

      // 휠과 손가락으로 넘기기
      var wheelLock = false;
      stage.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
        e.preventDefault();
        if (wheelLock) return;
        wheelLock = true;
        move(e.deltaX > 0 ? 1 : -1);
        setTimeout(function () { wheelLock = false; }, 320);
      }, { passive: false });

      var touchX = null;
      stage.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
      stage.addEventListener('touchend', function (e) {
        if (touchX === null) return;
        var d = e.changedTouches[0].clientX - touchX;
        if (Math.abs(d) > 40) move(d < 0 ? 1 : -1);
        touchX = null;
      });

      window.addEventListener('resize', render);
      render();
    }
  };

  /* ── 이미지 뷰어 ─────────────────────────── */
  var Lightbox = {
    init: function () {
      var box = document.getElementById('lightbox');
      var cells = document.querySelectorAll('[data-lightbox]');
      if (!box || !cells.length) return;

      this.box = box;
      this.cells = Array.prototype.slice.call(cells);
      this.stage = box.querySelector('.lightbox__stage');
      this.caption = box.querySelector('[data-lightbox-caption]');
      this.counter = box.querySelector('[data-lightbox-count]');
      this.index = 0;

      var self = this;

      this.cells.forEach(function (cell, i) {
        cell.addEventListener('click', function () { self.open(i); });
      });

      box.querySelector('[data-lightbox-close]').addEventListener('click', function () { self.close(); });
      box.querySelector('[data-lightbox-prev]').addEventListener('click', function () { self.move(-1); });
      box.querySelector('[data-lightbox-next]').addEventListener('click', function () { self.move(1); });

      box.addEventListener('click', function (e) { if (e.target === box) self.close(); });

      document.addEventListener('keydown', function (e) {
        if (!box.classList.contains('is-open')) return;
        if (e.key === 'Escape') self.close();
        if (e.key === 'ArrowLeft') self.move(-1);
        if (e.key === 'ArrowRight') self.move(1);
      });
    },

    open: function (i) {
      this.index = i;
      this.render();
      this.box.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    },

    close: function () {
      this.box.classList.remove('is-open');
      document.body.style.overflow = '';
    },

    move: function (d) {
      this.index = (this.index + d + this.cells.length) % this.cells.length;
      this.render();
    },

    render: function () {
      var cell = this.cells[this.index];
      var img = cell.querySelector('img');
      // 실제 사진이 있으면 그것을, 없으면 자리표시자를 띄운다
      var ph = cell.querySelector('.ph');
      this.stage.innerHTML = img ? img.outerHTML : (ph ? ph.outerHTML : '');
      if (this.caption) this.caption.textContent = cell.dataset.lightbox || '';
      if (this.counter) this.counter.textContent = (this.index + 1) + ' / ' + this.cells.length;
    }
  };

  /* ── 필터 ────────────────────────────────── */
  var Filter = {
    init: function () {
      var bar = document.querySelector('[data-filter-bar]');
      if (!bar) return;

      var items = document.querySelectorAll('[data-kind]');
      var count = document.querySelector('[data-filter-count]');
      var empty = document.querySelector('[data-filter-empty]');

      function apply(kind, push) {
        var shown = 0;
        items.forEach(function (el) {
          var hit = kind === 'all' || el.dataset.kind === kind;
          el.hidden = !hit;
          if (hit) shown++;
        });

        bar.querySelectorAll('.chip').forEach(function (chip) {
          chip.classList.toggle('is-on', chip.dataset.kindFilter === kind);
        });

        if (count) count.textContent = shown + '개';
        if (empty) empty.hidden = shown > 0;

        // 주소에 남겨 링크로 공유할 수 있게 한다
        if (push) {
          var u = new URL(location.href);
          if (kind === 'all') u.searchParams.delete('type');
          else u.searchParams.set('type', kind);
          history.replaceState(null, '', u);
        }
      }

      bar.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (chip) apply(chip.dataset.kindFilter, true);
      });

      apply(new URL(location.href).searchParams.get('type') || 'all', false);
    }
  };

  /* ── 시작 ────────────────────────────────── */
  function boot() {
    Reveal.init();
    Hero.init();
    HoverPreview.init();
    Bgm.init();
    Slider.init();
    Fan.init();
    Lightbox.init();
    Filter.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
