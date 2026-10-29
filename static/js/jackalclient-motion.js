(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const clamp = value => Math.min(1, Math.max(0, value));
    const easeOutCubic = progress => 1 - (1 - progress) ** 3;
    const easeInExpo = progress => progress <= 0 ? 0 : 2 ** (10 * progress - 10);
    const scenes = [...document.querySelectorAll('.jc-scene')];
    const desktop = document.querySelector('[data-story="desktop"]');
    const glassCanvas = document.getElementById('desktopGlass');
    const glass = glassCanvas && window.createJackalGlass ? window.createJackalGlass(glassCanvas) : null;
    const motionToggle = document.getElementById('glassMotionToggle');
    const letterRecords = new Map();
    let userPaused = false;
    let frame = 0;
    let resizePending = true;
    let previousColor = '';

    document.querySelectorAll('.jc-page-heading h1').forEach(title => {
        title.dataset.jcTitle = '';
        const track = document.createElement('div');
        track.className = 'jc-title-track';
        title.before(track);
        track.append(title);
    });
    const titles = [...document.querySelectorAll('[data-jc-title]')];
    const words = [...document.querySelectorAll('.jc-backdrop-word')];
    const waves = scenes.map(element => {
        const color = getComputedStyle(element).getPropertyValue('--jc-scene-bg').trim();
        let canvas = null;
        let context = null;
        if (previousColor && previousColor !== color) {
            canvas = document.createElement('canvas');
            canvas.className = 'jc-wipe';
            canvas.setAttribute('aria-hidden', 'true');
            try { context = canvas.getContext('2d'); } catch {}
            if (context) element.prepend(canvas);
        }
        const wave = { element, canvas, context, color: previousColor, width: 0, height: 0 };
        previousColor = element.dataset.story === 'desktop' ? '#121414' : color;
        return wave;
    });

    function passage(center, height) {
        const enter = easeOutCubic(clamp((height - center) / (height * .5)));
        const exit = easeInExpo(clamp((height * .26 - center) / (height * .46)));
        return { enter, exit, opacity: enter * (1 - exit) };
    }

    function playLetters(element) {
        const record = letterRecords.get(element);
        if (!record || record.played || preference.matches) return;
        record.played = true;
        record.glyphs.forEach((glyph, index) => {
            const seed = (glyph.textContent.codePointAt(0) * 29 + index * 71) % 421;
            const animation = glyph.animate([{ opacity: 0, transform: 'translateY(.45em)' }, { opacity: 1, transform: 'translateY(0)' }], {
                duration: 620, delay: seed, easing: 'cubic-bezier(.215,.61,.355,1)', fill: 'backwards'
            });
            animation.onfinish = () => animation.cancel();
            record.animations.push(animation);
        });
    }

    const letterObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            if (entry.target.closest('.jc-modules-panel') && !desktop?.classList.contains('is-modules')) return;
            playLetters(entry.target);
        });
    }, { threshold: .1 }) : null;

    function prepareLetters() {
        letterObserver?.disconnect();
        letterRecords.forEach(record => record.animations.forEach(animation => animation.cancel()));
        letterRecords.clear();
        document.querySelectorAll('[data-jc-letters]').forEach(element => {
            const text = element.querySelector('.jc-sr-only')?.textContent || element.textContent;
            element.textContent = text;
            if (preference.matches || !Element.prototype.animate) return;
            const readable = document.createElement('span');
            readable.className = 'jc-sr-only';
            readable.textContent = text;
            const visual = document.createElement('span');
            visual.setAttribute('aria-hidden', 'true');
            const tokens = typeof Intl.Segmenter === 'function'
                ? [...new Intl.Segmenter(document.documentElement.lang, { granularity: 'word' }).segment(text)].map(token => token.segment)
                : text.match(/\s+|[A-Za-z0-9]+|[^\s]/gu) || [];
            const glyphs = [];
            tokens.forEach(token => {
                if (/^\s+$/.test(token)) { visual.append(document.createTextNode(token)); return; }
                const word = document.createElement('span');
                word.className = 'jc-letter-word';
                const characters = typeof Intl.Segmenter === 'function'
                    ? [...new Intl.Segmenter(document.documentElement.lang, { granularity: 'grapheme' }).segment(token)].map(character => character.segment)
                    : [...token];
                characters.forEach(character => {
                    const glyph = document.createElement('span');
                    glyph.className = 'jc-glyph';
                    glyph.textContent = character;
                    word.append(glyph);
                    glyphs.push(glyph);
                });
                visual.append(word);
            });
            element.replaceChildren(readable, visual);
            letterRecords.set(element, { glyphs, played: false, animations: [] });
            if (letterObserver) letterObserver.observe(element);
            else playLetters(element);
        });
    }

    function updateMotionButton() {
        if (!motionToggle) return;
        motionToggle.hidden = preference.matches || glassCanvas?.dataset.renderer !== 'webgl2';
        motionToggle.setAttribute('aria-pressed', String(userPaused));
        motionToggle.dataset.i18n = userPaused ? 'motion.resume' : 'motion.pause';
        motionToggle.textContent = jackalText(motionToggle.dataset.i18n);
    }

    function drawWave(wave, progress) {
        const { context, width, height } = wave;
        if (!context || !width || !height) return;
        context.clearRect(0, 0, width, height);
        if (progress >= 1) return;
        const spacing = innerWidth <= 600 ? 18 : 24;
        const columns = Math.ceil(width / spacing);
        const rows = Math.ceil(height / spacing);
        context.fillStyle = wave.color;
        context.beginPath();
        for (let row = 0; row <= rows; row++) {
            for (let column = 0; column <= columns; column++) {
                const diagonal = (column / columns + row / rows) / 2;
                const radius = spacing * .73 * (1 - clamp(progress * 2.3 - diagonal * 1.3));
                if (radius < .2) continue;
                const horizontal = column * spacing;
                const vertical = row * spacing;
                context.moveTo(horizontal + radius, vertical);
                context.arc(horizontal, vertical, radius, 0, Math.PI * 2);
            }
        }
        context.fill();
    }

    function render() {
        frame = 0;
        if (document.hidden) return;
        const reduced = preference.matches;
        document.body.classList.toggle('jc-motion', !reduced);
        const height = innerHeight;
        const sceneMeasurements = waves.map(wave => ({ wave, bounds: wave.element.getBoundingClientRect() }));
        const titleMeasurements = titles.map(title => ({ title, bounds: title.parentElement.getBoundingClientRect() }));
        const wordMeasurements = words.map(word => ({ word, bounds: (word.closest('[data-motion-stage]') || word.closest('.jc-scene')).getBoundingClientRect() }));
        const range = document.documentElement.scrollHeight - height;
        document.body.style.setProperty('--jc-page-progress', range > 0 ? clamp(scrollY / range) : 1);
        glass?.setPaused(reduced || userPaused);

        sceneMeasurements.forEach(({ wave, bounds }) => {
            if (wave.canvas) wave.canvas.hidden = reduced;
            if (reduced) return;
            if (resizePending && wave.context) {
                const density = Math.min(devicePixelRatio || 1, 1.5);
                wave.width = bounds.width;
                wave.height = Math.min(120, Math.max(60, innerWidth * .08));
                wave.canvas.width = Math.round(wave.width * density);
                wave.canvas.height = Math.round(wave.height * density);
                wave.context.setTransform(density, 0, 0, density, 0, 0);
            }
            if (bounds.top > height || bounds.bottom < 0) return;
            const position = Math.min(1, Math.max(-1, bounds.top / height));
            wave.element.style.setProperty('--jc-drift', `${Math.round(position * 48)}px`);
            wave.element.style.setProperty('--jc-rotation', `${-24 + position * 12}deg`);
            drawWave(wave, clamp((height - bounds.top) / (height * .95)));
        });

        if (!reduced) {
            titleMeasurements.forEach(({ title, bounds }) => {
                const progress = passage(bounds.top + bounds.height / 2, height);
                title.style.setProperty('--jc-title-opacity', progress.opacity.toFixed(5));
                title.style.setProperty('--jc-title-x', `${((1 - progress.enter) * 180 - progress.exit * 130).toFixed(2)}px`);
                title.style.setProperty('--jc-title-y', `${((1 - progress.enter) * 38).toFixed(2)}px`);
                title.dataset.enter = progress.enter.toFixed(5);
                title.dataset.exit = progress.exit.toFixed(5);
            });
            wordMeasurements.forEach(({ word, bounds }) => {
                const progress = passage(bounds.top + Math.min(bounds.height, height) * .5, height);
                word.style.setProperty('--jc-word-opacity', progress.opacity.toFixed(5));
                word.style.setProperty('--jc-word-x', `${((1 - progress.enter) * innerWidth * .45 - progress.exit * innerWidth * .35).toFixed(2)}px`);
                word.dataset.enter = progress.enter.toFixed(5);
                word.dataset.exit = progress.exit.toFixed(5);
            });
        }

        const desktopMeasurement = sceneMeasurements.find(measurement => measurement.wave.element === desktop);
        if (desktopMeasurement) {
            const { bounds } = desktopMeasurement;
            const progress = clamp(-bounds.top / Math.max(1, bounds.height - height));
            const showModules = !reduced && progress >= .38;
            desktop.dataset.progress = progress.toFixed(5);
            desktop.classList.toggle('is-modules', showModules);
            desktop.style.setProperty('--jc-cheat-opacity', 1 - easeOutCubic(clamp((progress - .22) / .16)));
            desktop.style.setProperty('--jc-glass-scale', 1 - clamp((progress - .22) / .16) * .06);
            const moduleOpacity = easeOutCubic(clamp((progress - .38) / .18));
            desktop.style.setProperty('--jc-modules-opacity', moduleOpacity);
            desktop.style.setProperty('--jc-modules-y', `${(1 - moduleOpacity) * 35}px`);
            const cheat = desktop.querySelector('.jc-desktop-cheat');
            const modules = desktop.querySelector('.jc-modules-panel');
            cheat.inert = !reduced && progress >= .38;
            modules.inert = !reduced && !showModules;
            cheat.setAttribute('aria-hidden', String(!reduced && progress >= .38));
            modules.setAttribute('aria-hidden', String(!reduced && !showModules));
            if (showModules) modules.querySelectorAll('[data-jc-letters]').forEach(playLetters);
            glass?.setVisible(!reduced && bounds.top < height && bounds.bottom > 0 && progress < .38);
        }
        const custom = sceneMeasurements.find(measurement => measurement.wave.element.dataset.story === 'custom');
        if (custom && !reduced) {
            const progress = easeOutCubic(clamp((height - custom.bounds.top) / height));
            custom.wave.element.style.setProperty('--jc-custom-y', `${(1 - progress) * 80}px`);
            custom.wave.element.style.setProperty('--jc-custom-scale', .9 + progress * .1);
        }
        if (resizePending) glass?.resize();
        resizePending = false;
    }

    function requestRender() { if (!frame && !document.hidden) frame = requestAnimationFrame(render); }
    function requestResize() { resizePending = true; requestRender(); }
    motionToggle?.addEventListener('click', () => { userPaused = !userPaused; updateMotionButton(); requestRender(); });
    window.addEventListener('scroll', requestRender, { passive: true });
    window.addEventListener('resize', requestResize, { passive: true });
    window.addEventListener('pageshow', requestResize);
    window.addEventListener('pagehide', event => { cancelAnimationFrame(frame); frame = 0; glass?.setVisible(false); if (!event.persisted) glass?.destroy(); });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { cancelAnimationFrame(frame); frame = 0; glass?.setVisible(false); }
        else requestResize();
    });
    document.addEventListener('jackal:language', () => { prepareLetters(); updateMotionButton(); requestResize(); });
    document.addEventListener('jackal:glass', updateMotionButton);
    preference.addEventListener('change', () => { prepareLetters(); updateMotionButton(); requestResize(); });
    if ('ResizeObserver' in window) new ResizeObserver(requestResize).observe(document.getElementById('main'));
    document.fonts?.ready.then(requestResize);
    prepareLetters();
    updateMotionButton();
    requestRender();
})();
